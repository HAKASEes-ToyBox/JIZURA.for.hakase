"""Convert the pinned SkyTNT ISNet ONNX to fixed 512x512, without changing weights.

Requires onnx==1.17.0 and numpy. See docs/person-cutout.md for reproduction.
The small browser graph references tensor bytes in the original cached ONNX;
--standalone optionally writes an ordinary, self-contained ONNX for other apps.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnx
from onnx import numpy_helper, external_data_helper

REVISION = "a0a563c41338cbe0d23dfb4bfc3e243c518e5768"
SOURCE_URL = f"https://huggingface.co/skytnt/anime-seg/resolve/{REVISION}/isnetis.onnx"
SOURCE_SHA256 = "f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99"
LOCATION = "isnetis.onnx"


def fields(data, start=0, end=None):
    """Yield protobuf field number, wire type and payload offsets, without copies."""
    end = len(data) if end is None else end
    pos = start

    def varint():
        nonlocal pos
        value = shift = 0
        while pos < end and shift < 70:
            byte = data[pos]
            pos += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
            shift += 7
        raise ValueError("Invalid protobuf varint")

    while pos < end:
        tag = varint()
        number, wire = tag >> 3, tag & 7
        if wire == 2:
            length = varint()
            begin = pos
            pos += length
        elif wire == 0:
            begin = pos
            varint()
        elif wire in (1, 5):
            begin = pos
            pos += 8 if wire == 1 else 4
        else:
            raise ValueError(f"Unexpected protobuf wire type {wire}")
        if not number or pos > end:
            raise ValueError("Invalid protobuf field")
        yield number, wire, begin, pos


def tensor_offsets(data):
    offsets = {}
    # ONNX ModelProto.graph = 7; GraphProto.initializer = 5;
    # TensorProto.name = 8; TensorProto.raw_data = 9.
    for number, wire, begin, end in fields(data):
        if number != 7 or wire != 2:
            continue
        for number, wire, begin, end in fields(data, begin, end):
            if number != 5 or wire != 2:
                continue
            parts = {n: (b, e) for n, w, b, e in fields(data, begin, end) if w == 2}
            if 8 in parts and 9 in parts:
                b, e = parts[8]
                name = data[b:e].decode("utf-8")
                offsets[name] = parts[9]
    return offsets


def convert(source, output, standalone=None):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError("Source hash mismatch; use the pinned original isnetis.onnx")
    model = onnx.load_from_string(data)
    initializers = {tensor.name: tensor for tensor in model.graph.initializer}
    resized = set()
    for node in model.graph.node:
        if node.op_type != "Resize":
            continue
        if len(node.input) != 4 or node.input[3] not in initializers:
            raise ValueError("Unexpected Resize node")
        name = node.input[3]
        if name in resized:
            continue
        tensor = initializers[name]
        sizes = numpy_helper.to_array(tensor).copy()
        if sizes.shape != (4,) or sizes.dtype != np.int64 or np.any(sizes[2:] % 2):
            raise ValueError("Unexpected fixed spatial resize target")
        sizes[2:] //= 2  # Preserve batch and channel dimensions.
        tensor.CopyFrom(numpy_helper.from_array(sizes, name))
        resized.add(name)
    if len(resized) != 34:
        raise ValueError("Unexpected model graph; expected 34 fixed Resize targets")
    for tensor in [*model.graph.input, *model.graph.output]:
        shape = tensor.type.tensor_type.shape.dim
        if [d.dim_value for d in shape[2:]] != [1024, 1024]:
            raise ValueError("Unexpected original input/output dimensions")
        shape[2].dim_value = shape[3].dim_value = 512
    # All intermediate annotations describe the old 1024 graph. Re-infer them.
    del model.graph.value_info[:]
    model.doc_string += "\nJIZURA modification: fixed 512x512 input/output and 34 spatial Resize targets; original weights unchanged."
    model = onnx.shape_inference.infer_shapes(model, strict_mode=True, data_prop=True)
    onnx.checker.check_model(model, full_check=True)
    if standalone:
        standalone.parent.mkdir(parents=True, exist_ok=True)
        onnx.save_model(model, standalone)

    offsets = tensor_offsets(data)
    external_count = 0
    for tensor in model.graph.initializer:
        if len(tensor.raw_data) < 1024 or tensor.name in resized:
            continue
        begin, end = offsets[tensor.name]
        if data[begin:end] != tensor.raw_data:
            raise ValueError(f"Weight changed: {tensor.name}")
        external_data_helper.set_external_data(tensor, LOCATION, begin, end - begin)
        tensor.ClearField("raw_data")
        external_count += 1
    output.mkdir(parents=True, exist_ok=True)
    graph_bytes = model.SerializeToString()
    graph = output / "isnetis-512.onnx"
    graph.write_bytes(graph_bytes)
    manifest = {
        "model": "SkyTNT Anime Segmentation / ISNet", "license": "Apache-2.0",
        "modification": "512x512 spatial input/output and Resize targets; unchanged float32 weights",
        "sourceUrl": SOURCE_URL, "sourceSha256": SOURCE_SHA256,
        "externalDataLocation": LOCATION, "sourceBytes": len(data),
        "inputShape": [1, 3, 512, 512], "outputShape": [1, 1, 512, 512],
        "graphBytes": len(graph_bytes), "graphSha256": hashlib.sha256(graph_bytes).hexdigest(),
        "resizeTargets": len(resized), "externalTensors": external_count,
        "onnxVersion": onnx.__version__,
    }
    (output / "isnetis-512.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "assets/models")
    parser.add_argument("--standalone", type=Path)
    args = parser.parse_args()
    convert(args.source, args.output, args.standalone)

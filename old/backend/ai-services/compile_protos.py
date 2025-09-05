#!/usr/bin/env python3
"""
Compile protocol buffer files for AI Services
"""

import os
import sys
from pathlib import Path
import subprocess

def compile_protos():
    """Compile all proto files"""
    # Get paths
    current_dir = Path(__file__).parent
    # In Docker, proto files are mounted at /proto
    if os.path.exists("/proto"):
        proto_dir = Path("/proto")
    else:
        proto_dir = current_dir.parent.parent / "proto"
    output_dir = current_dir / "src" / "proto"
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Create __init__.py in proto directory
    init_file = output_dir / "__init__.py"
    if not init_file.exists():
        init_file.write_text("")
    
    # Find all proto files
    proto_files = list(proto_dir.glob("*.proto"))
    
    if not proto_files:
        print(f"No proto files found in {proto_dir}")
        return False
    
    print(f"Found {len(proto_files)} proto files")
    
    # Compile each proto file
    for proto_file in proto_files:
        print(f"Compiling {proto_file.name}...")
        
        cmd = [
            sys.executable, "-m", "grpc_tools.protoc",
            f"--proto_path={proto_dir}",
            f"--python_out={output_dir}",
            f"--pyi_out={output_dir}",
            f"--grpc_python_out={output_dir}",
            str(proto_file)
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Error compiling {proto_file.name}:")
                print(result.stderr)
                return False
        except Exception as e:
            print(f"Failed to compile {proto_file.name}: {e}")
            return False
    
    print("All proto files compiled successfully")
    
    # Fix imports in generated files to use relative imports
    for py_file in output_dir.glob("*_pb2.py"):
        content = py_file.read_text()
        # Replace absolute imports with relative imports
        content = content.replace("import common_pb2", "from . import common_pb2")
        py_file.write_text(content)
        print(f"Fixed imports in {py_file.name}")
    
    for py_file in output_dir.glob("*_pb2_grpc.py"):
        content = py_file.read_text()
        # Replace absolute imports with relative imports
        content = content.replace("import chat_pb2", "from . import chat_pb2")
        content = content.replace("import common_pb2", "from . import common_pb2")
        py_file.write_text(content)
        print(f"Fixed imports in {py_file.name}")
    
    return True

if __name__ == "__main__":
    success = compile_protos()
    sys.exit(0 if success else 1)
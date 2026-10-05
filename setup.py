"""
Cython compilation script for MotoRide (Django + Channels/Daphne).

Usage:
    python setup.py build_ext --inplace
"""
import os
from setuptools import setup
from Cython.Build import cythonize

SKIP_DIRS = {
    "migrations", "__pycache__", "venv", "env", "ENV", ".venv",
    "dist", "build", ".git", ".idea", "node_modules",
    "static", "media", "staticfiles", "locale",
}

SKIP_FILES = {
    "manage.py",
    "setup.py",
    "settings.py",
    "asgi.py",
    "wsgi.py",
    "__init__.py",
    "main.py",
}


def collect_py_files():
    all_files = []
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for file in files:
            if not file.endswith(".py") or file in SKIP_FILES:
                continue
            filepath = os.path.join(root, file)
            if filepath.startswith("./"):
                filepath = filepath[2:]
            all_files.append(filepath.replace("\\", "/"))
    return all_files


py_files = collect_py_files()
print(f"\nTotal files to compile: {len(py_files)}\n")

setup(
    ext_modules=cythonize(
        py_files,
        compiler_directives={"language_level": "3"},
        nthreads=4,
        quiet=False,
    )
)
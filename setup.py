from setuptools import setup, find_packages

setup(
    name="envir-social",
    version="0.1.0",
    description="Simple environmental reporting social network prototype",
    author="Auto Generated",
    python_requires=">=3.10",
    packages=find_packages(exclude=("tests", "tests.*")),
    include_package_data=True,
    install_requires=[],  # Runtime deps are managed via requirements.txt to support offline installs.
    extras_require={
        "deps": [
            "fastapi>=0.110",
            "uvicorn[standard]>=0.25",
            "pillow>=10.0",
            "python-multipart>=0.0.6",
        ],
        "dev": [
            "httpx>=0.25",
            "pytest>=7.4",
        ],
    },
)

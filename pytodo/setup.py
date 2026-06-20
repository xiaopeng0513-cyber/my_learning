from setuptools import find_packages, setup

setup(
    name="pytodo-app",
    version="1.0.0",
    description="A self-hosted personal task manager with sharing, installable as a PWA",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="PyTodo Contributors",
    url="https://github.com/example/pytodo",
    packages=find_packages(exclude=["tests*"]),
    include_package_data=True,
    package_data={
        "pytodo": [
            "templates/*.html",
            "static/css/*.css",
            "static/js/*.js",
            "static/manifest.json",
            "static/icons/*.png",
        ],
    },
    python_requires=">=3.9",
    install_requires=[
        "flask>=3.0",
        "pyjwt>=2.8",
    ],
    entry_points={
        "console_scripts": [
            "pytodo=pytodo.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Environment :: Web Environment",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)

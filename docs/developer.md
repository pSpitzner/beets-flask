# Developer Information


## Documentation

For documentation we use [sphinx](https://www.sphinx-doc.org/en/master/) and [mMST](https://myst-parser.readthedocs.io/en/latest/). This allows us to write markdown files and include them in the documentation. You can find all documentation files in the `docs` folder.

You may build the documentation locally with.

```bash
# Install the requirements
cd backend
pip install -e .[docs]
# Build the documentation
cd docs
make html
```
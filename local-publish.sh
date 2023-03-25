#!/bin/bash

# Script, which publishes this lib to my local registry

npm run build && npm publish --registry http://verdaccio:4873/
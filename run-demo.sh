#! /bin/bash

# Data backend runs on 3020
node data/app.js &

# Webpack dev server runs on 8000, that's where the browser connects
export PORT=8000
export DANGEROUSLY_DISABLE_HOST_CHECK=true

cd demo
npm start &

cd ..

# Anything else tends to break the models
export CUDA=0

# Python server runs on 8080
export ALLENNLP_DEMO_PORT=8080

python server/app.py


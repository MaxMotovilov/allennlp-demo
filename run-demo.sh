#! /bin/bash

case $1 in
	start)
		kill -0 $(<run-demo.pid) && {
			ps -ef | grep run-demo
			echo To stop: ./run-demo.sh stop
			exit 1
		}
		nohup ./run-demo.sh 2>&1 >running-demo.log &
		echo !$ >run-demo.pid
		exit 0
	;;
	stop)
		kill -HUP $(<run-demo.pid)
		rm run-demo.pid
		exit 0
	;;
esac

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


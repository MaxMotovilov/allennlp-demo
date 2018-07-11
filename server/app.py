#!/usr/bin/env python

"""
A `Flask <http://flask.pocoo.org/>`_ server that serves up our demo.
"""
from datetime import datetime
from typing import Dict, Optional
import json
import logging
import os
import sys
import time
from functools import lru_cache
from itertools import groupby

from flask import Flask, request, Response, jsonify, send_file, send_from_directory
from flask_cors import CORS
from gevent.pywsgi import WSGIServer

import pytz

from allennlp.common.util import JsonDict, peak_memory_mb
#from allennlp.service.db import DemoDatabase, PostgresDemoDatabase
#from allennlp.service.permalinks import int_to_slug, slug_to_int

from server.models import MODELS
from allennlp.predictors.predictor import Predictor

# Can override cache size with an environment variable. If it's 0 then disable caching altogether.
CACHE_SIZE = os.environ.get("FLASK_CACHE_SIZE") or 128
PORT = int(os.environ.get("ALLENNLP_DEMO_PORT") or 8080)
DEMO_DIR = os.environ.get("ALLENNLP_DEMO_DIRECTORY") or 'demo/'

logger = logging.getLogger(__name__)  # pylint: disable=invalid-name
logger.setLevel(logging.INFO)
logger.addHandler( logging.StreamHandler() )

class ServerError(Exception):
    status_code = 400

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        error_dict = dict(self.payload or ())
        error_dict['message'] = self.message
        return error_dict

def main():
    """Run the server programatically"""
    logger.info("Starting a flask server on port %i.", PORT)

    app = make_app()
    CORS(app)

    for name, demo_model in MODELS.items():
        logger.info(f"loading {name} model")
        predictor = demo_model.predictor()
        app.predictors[name] = predictor

    http_server = WSGIServer(('0.0.0.0', PORT), app)
    logger.info("Server started on port %i.  Please visit: http://localhost:%i", PORT, PORT)
    http_server.serve_forever()

class Next(object):
    def __init__(self, v):
        self.value = v

    def __call__(self, bump):
        if bump:
            self.value += 1
        return self.value

def top_spans( starts, ends, n ):
    assert len(starts) == len(ends)
    return sorted(
              (
                max(
                  (
                     (starts[p][i] + ends[p][j], p, i, j)
                       for i in range(len(starts[p]))
                         for j in range(i, len(ends[p]))
                  )
                ) for p in range(len(starts))
              ), reverse=True
            )[:n]

def make_app(build_dir: str = None) -> Flask:
    if build_dir is None:
        build_dir = os.path.join(DEMO_DIR, 'build')

    if not os.path.exists(build_dir):
        logger.error("app directory %s does not exist, aborting", build_dir)
        sys.exit(-1)

    app = Flask(__name__)  # pylint: disable=invalid-name
    start_time = datetime.now(pytz.utc)
    start_time_str = start_time.strftime("%Y-%m-%d %H:%M:%S %Z")

    app.predictors = {}

    try:
        cache_size = int(CACHE_SIZE)  # type: ignore
    except ValueError:
        logger.warning("unable to parse cache size %s as int, disabling cache", CACHE_SIZE)
        cache_size = 0

    @app.errorhandler(ServerError)
    def handle_invalid_usage(error: ServerError) -> Response:  # pylint: disable=unused-variable
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response

    @lru_cache(maxsize=cache_size)
    def _caching_prediction(model: Predictor, data: str) -> JsonDict:
        """
        Just a wrapper around ``model.predict_json`` that allows us to use a cache decorator.
        """
        return model.predict_json(json.loads(data))

    @app.route('/')
    def index() -> Response: # pylint: disable=unused-variable
        return send_file(os.path.join(build_dir, 'index.html'))

    @app.route('/predict/<model_name>', methods=['POST', 'OPTIONS'])
    def predict(model_name: str) -> Response:  # pylint: disable=unused-variable
        """make a prediction using the specified model and return the results"""
        if request.method == "OPTIONS":
            return Response(response="", status=200)

        req_data = request.get_json()

        bidaf_data = {
            'question': req_data['question']
        }

        if model_name == "doc":
            bidaf_data['passage'] = " ".join( (p['cpar'] for p in req_data['doc']) )
        else:
            if model_name != "section" and model_name != "doc-slice":
                raise ServerError("unknown predictor: {}".format(model_name), status_code=404)

            mp_data = {
                'question': req_data['question']
            }

            if model_name == "doc-slice":
                mp_data['passages'] = [p['cpar'] for p in req_data['doc']]
            else:
                next = Next(0)
                mp_data['passages'] = [" ".join( (p['cpar'] for p in g) ) for g in groupby( req_data['doc'], key=lambda p: next(p.get('section', False)) )]

            mp_results = app.predictors['MP'].predict_json( mp_data )

            if model_name == "doc-slice":
                top = top_spans( mp_results['paragraph_span_start_logits'], mp_results['paragraph_span_end_logits'], req_data.get('topN', 3) )

                bidaf_data['passage'] = ' '.join(
                    mp_data['passages'][
                      slice(
                         min( (t[1] for t in top) ),
                         1+max( (t[1] for t in top) )
                      )
                    ]
                 )
            else:
                bidaf_data['passage'] = mp_data['passages'][mp_results['best_span'][0]]

        results = app.predictors['BiDAF'].predict_json( bidaf_data )

        logger.info("prediction: %s", json.dumps({
            'question': req_data['question'],
            'span': results['best_span'],
            'text': results['best_span_str']
        }))

        print(results)

        return jsonify(results)

    return app

if __name__ == "__main__":
    main()

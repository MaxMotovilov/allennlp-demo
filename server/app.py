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
from itertools import groupby, islice

from flask import Flask, request, Response, jsonify, send_file, send_from_directory
from flask_cors import CORS
from gevent.pywsgi import WSGIServer

import pytz

from allennlp.common.util import JsonDict, peak_memory_mb
#from allennlp.service.db import DemoDatabase, PostgresDemoDatabase
#from allennlp.service.permalinks import int_to_slug, slug_to_int

from server.models import MODELS
from allennlp.predictors.predictor import Predictor

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import pairwise_distances

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

def mp_scores( starts, ends ):
    assert len(starts) == len(ends)
    return [
        max( 0, max(
            (
                 starts[p][i] + ends[p][j]
                   for i in range(len(starts[p]))
                     for j in range(i, len(ends[p]))
            )
        ) ) for p in range(len(starts))
    ]

def window(seq, n=2):
    "Returns a sliding window (of width n) over data from the iterable"
    "   s -> (s0,s1,...s[n-1]), (s1,s2,...,sn), ...                   "
    it = iter(seq)
    result = tuple(islice(it, n))
    if len(result) == n:
        yield result
    for elem in it:
        result = result[1:] + (elem,)
        yield result

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

        if model_name not in {'doc', 'section', 'doc-slice', 'section-mp', 'doc-slice-mp'}:
            raise ServerError("unknown predictor: {}".format(model_name), status_code=404)

        req_data = request.get_json()

        bidaf_data = {
            'question': req_data['question']
        }

        if model_name in {"doc", "doc-slice", "doc-slice-mp"}:
            paragraphs = [p['cpar'] for p in req_data['doc']]
        else:
            next = Next(0)
            sections = [[p['cpar'] for p in g] for _, g in groupby( req_data['doc'], key=lambda p: next(p.get('section', False)) )]

        if model_name == "doc":
            bidaf_data['passage'] = " ".join( paragraphs )
        else:
            if model_name in {"doc-slice", "doc-slice-mp"}:
                slice_size = req_data.get( "sliceSize", 10 )

            if model_name in {"doc-slice", "section"}:
                tfidf = TfidfVectorizer(strip_accents="unicode", stop_words="english")

                if model_name == "doc-slice":
                    text_features = tfidf.fit_transform(paragraphs)
                else: # if model_name == "section":
                    text_features = tfidf.fit_transform( (" ".join(s) for s in sections) )

                question_features = tfidf.transform([req_data['question']])
                scores = -pairwise_distances(question_features, text_features, "cosine").ravel() + 1

                if model_name == "section":
                    best_section = max( range(len(sections)), key = lambda i: scores[i] )
                else: # if model_name == "doc-slice":
                    slice_scores = [
                        1 - pairwise_distances(question_features, tfidf.transform([ " ".join(s_texts) ]), "cosine").ravel()[0]
                        if sum(scores) > 0 else 0
                            for s_texts, s_scores in zip(window(paragraphs, slice_size), window(scores, slice_size))
                    ]

            else: # if model_name in {"doc-slice-mp", "section-mp"}:
                if model_name == "doc-slice-mp":
                    mp_data= {'question': req_data['question'], 'passages': paragraphs}
                    mp_results = app.predictors['MP'].predict_json( mp_data )
                else: # if model_name == "section-mp":
                    mp_data = [{'question': req_data['question'], 'passages': s} for s in sections]
                    mp_results = app.predictors['MP'].predict_batch_json( mp_data )
                    best_section = max( range(len(mp_results)), key = lambda i: logit_score(mp_results[i]) )
                    mp_results = mp_results[ best_section ]

                logger.info("MP prediction: %s", json.dumps({
                    'question': req_data['question'],
                    'span': mp_results['best_span'],
                    'text': mp_results['best_span_str']
                }))

                if model_name == "doc-slice-mp":
                    scores = mp_scores(mp_results['paragraph_span_start_logits'], mp_results['paragraph_span_end_logits'])

            if model_name in {"doc-slice", "doc-slice-mp"}:
                if model_name == "doc-slice":
                    best, scores = max(enumerate(slice_scores), key = lambda e: e[1])
                else: # if model_name == "doc-slice-mp":
                    best, scores = max(enumerate(window(scores, slice_size)), key = lambda e: sum(e[1]))
                bidaf_data['passage'] = ' '.join( paragraphs[best:best+slice_size] )
                logger.info("Best slice at %d: %s", best, scores)
            else: # if model_name in {"section", "section-mp"}:
                bidaf_data['passage'] = ' '.join( sections[best_section] )

        results = app.predictors['BiDAF'].predict_json( bidaf_data )

        logger.info("BiDAF prediction: %s", json.dumps({
            'question': req_data['question'],
            'span': results['best_span'],
            'text': results['best_span_str']
        }))

        if model_name == "doc":
            char_range = map_span( tuple( results['best_span'] ), results['passage_tokens'], paragraphs )
        elif model_name in {"doc-slice", "doc-slice-mp"}:
            f, t = map_span( tuple( results['best_span'] ), results['passage_tokens'], paragraphs[best:best+slice_size] )
            char_range = (add_par(f, best), add_par(t, best))
        else: # if model_name in {"section", "section-mp"}:
            f, t = map_span( tuple( results['best_span'] ), results['passage_tokens'], sections[best_section] )
            offs = sum( ( len(sections[s]) for s in range(best_section) ) )
            char_range = (add_par(f, offs), add_par(t, offs))

        return jsonify({
            'text': results['best_span_str'],
            'range': char_range
        })

    return app

def add_par(par_pos, add):
    par, pos = par_pos
    return par+add, pos

def logit_score(output):
    par, f, t = output['best_span']
    return output['paragraph_span_start_logits'][par][f] + output['paragraph_span_end_logits'][par][t]

class TokenMatcher(object):
    def __init__(self, paragraphs):
        self.iter = iter(paragraphs)
        self.par = -1
        self.pos = 0
        self.top = ""

    def next(self, token):
        while self.top[:len(token)] != token:
            if self.top == "":
                try:
                    self.top = next(self.iter)
                except StopIteration:
                    raise ServerError( "ran out of passage on '{}'".format(token), status_code=500 )
                self.pos = 0
                self.par += 1
            else:
                self.top = self.top[1:]
                self.pos += 1

        result = self.pos
        self.pos += len(token)
        self.top = self.top[len(token):]

        return self.par, result, self.pos

def map_span( span, tokens, text ):
    b, e = span
    m = TokenMatcher( text )

    for i in range(len(tokens)):
        par, f, t = m.next(tokens[i])
        if i==b:
            begin = (par, f)
        if i==e:
            return begin, (par, t)

    raise ServerError( "{} is outside range of tokens".format(e), status_code=500 )

if __name__ == "__main__":
    main()

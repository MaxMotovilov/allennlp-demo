import spacy, re
import numpy as np

from itertools import chain, repeat
from functools import reduce
from time import perf_counter

nlp = spacy.load( 'en_core_web_md', disable=['parser', 'tagger', 'ner'] )

def _amplify( x, mean, sigma ):
    e = np.exp( (x-mean)**2 / (2*sigma**2) )
    return (e-1)/e

def _withoutStopWords( tokens ):
    """ .is_stop is still broken in spaCy :( """
    return [t for t in tokens if not t.lemma_.lower() in nlp.Defaults.stop_words and not t.is_punct]

class SliceBySimilarityToQuery(object):
    def __init__(self, paragraphs, query, amplify='positive-2-stdev'):
        self.timings = [perf_counter()]
        amplify = re.fullmatch( r'(positive|both)-(\d+)-stdev', amplify )
        assert( amplify is not None )

        width = float( amplify[2] )

        if amplify[1] == 'both':
            amplify = lambda x, mean, sigma: _amplify( x, mean, sigma*width )
        else:
            amplify = lambda x, mean, sigma: _amplify( np.ma.array(x, mask=(x<mean)), mean, sigma*width ).filled(0.0)

        self.byte_counts = np.asarray( [ len(p) for p in paragraphs ], dtype=np.int32 )

        paragraphs = nlp.pipe( chain( (query,), paragraphs ) )
        self.query = _withoutStopWords( next(paragraphs) )

        sim_cache = dict()
        def similarity(q,p):
            key = (max(q.orth, p.orth), min(q.orth, p.orth))
            if key not in sim_cache:
                sim_cache[key] = q.similarity(p)
            return sim_cache[key]

        paragraphs = [
            tuple(
                max(
                    similarity(q, p) if q.has_vector and p.has_vector else (
                        1.0 if q.lemma_.lower() == p.lemma_.lower() else 0.0
                    ) for p in par
                ) for q in self.query
            ) if len(par) > 0 else tuple( repeat( 0, len(self.query) ) )
                for par in (
                    _withoutStopWords(par) for par in paragraphs
                )
        ]

        self.timings.append( perf_counter() )

        # Build a row-of-columns array for faster processing
        paragraphs = np.asarray( paragraphs, dtype=np.float32, order='F' )

        # Term-weight representation of paragraphs
        self.paragraphs = np.transpose( np.asarray( [
            amplify(
                paragraphs[:,i],
                np.mean( paragraphs[:,i] ),
                np.std( paragraphs[:,i] )
            ) if self.query[i].has_vector else paragraphs[:,i]
                for i in range(paragraphs.shape[1])
        ], order='C' ) )

        # Generalized IDF weighting
        self.paragraphs *= np.log( float(self.paragraphs.shape[0]) / (1 + np.sum( self.paragraphs, 0 )) )

        self.timings.append( perf_counter() )

    def best(self, top=1, dropOff=None, count=None, byteCount=None ):
        """ Finds and returns up to `top' best slices ordered by decreasing score. """

        if count is None and byteCount is None:
            return [range(self.paragraphs)]

        if count is None:
            count = len(self.paragraphs)

        score = lambda r: self.paragraphs[r[0]:r[1]].max(0).sum()

        def enumWindows():
            bc = -1
            fr = 0
            to = 0

            while True:
                while to < len(self.byte_counts) and \
                       (bc < 0 or bc+self.byte_counts[to]+1 <= byteCount) and \
                       to-fr <= count:
                    bc += self.byte_counts[to]+1
                    to += 1

                yield (fr, to)

                if to == len(self.byte_counts):
                    break

                bc += self.byte_counts[to]+1
                to += 1

                while (bc > byteCount or to-fr > count) and fr+1 < to:
                    bc -= self.byte_counts[fr]+1
                    fr += 1

        # Greedy algorithm: top scoring ranges are the largest possible

        if byteCount is None:
            q = sorted( ( (i, i+count) for i in range(len(self.paragraphs)-count+1)), key=score )
        else:
            q = sorted( enumWindows(), key=score )

        result = []

        while len(q) > 0 and len(result) < top:
            next = q.pop()
            if dropOff is not None and len(result) > 0 and score( next ) < score(result[0])*dropOff:
                break

            start, end = next
            q = sorted( (
                (
                    s if s < start or s >= end else max(end, s),
                    e if e > end or e <= start else min(start, e)
                )
                    for s,e in q
                        if s < start or e > end
            ), key=score)

            result.append( next )

        self.timings.append( perf_counter() )

        return result, list( map( score, result ) ), self.paragraphs.tolist(), [q.lemma_.lower() for q in self.query]


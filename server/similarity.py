import spacy, re
import numpy as np

from itertools import chain, repeat
from functools import reduce

nlp = spacy.load( 'en_core_web_md', disable=['parser', 'tagger', 'ner'] )

def _amplify( x, mean, sigma ):
    e = np.exp( (x-mean)**2 / (2*sigma**2) )
    return (e-1)/e

def _withoutStopWords( tokens ):
    """ .is_stop is still broken in spaCy :( """
    return [t for t in tokens if not t.lemma_.lower() in nlp.Defaults.stop_words and not t.is_punct]

class SliceBySimilarityToQuery(object):
    def __init__(self, paragraphs, query, reduce='max', norm='L1', amplify='positive-2-stdev'):
        amplify = re.fullmatch( r'(positive|both)-(\d+)-stdev', amplify )
        assert( amplify is not None )
        assert( reduce == 'max' )
        assert( norm == 'L1' )

        width = float( amplify[2] )

        if amplify[1] == 'both':
            amplify = lambda x, mean, sigma: _amplify( x, mean, sigma*width )
        else:
            amplify = lambda x, mean, sigma: _amplify( np.ma.array(x, mask=(x<mean)), mean, sigma*width ).filled(0.0)

        self.byte_counts = np.asarray( [ len(p) for p in paragraphs ], dtype=np.int32 )

        paragraphs = nlp.pipe( chain( (query,), paragraphs ) )
        self.query = _withoutStopWords( next(paragraphs) )

        paragraphs = [
            tuple(
                max( # reduce=max
                    q.similarity(p) if q.has_vector and p.has_vector else (
                        1.0 if q.lemma_.lower() == p.lemma_.lower() else 0.0
                    ) for p in par
                ) for q in self.query
            ) if len(par) > 0 else tuple( repeat( 0, len(self.query) ) )
                for par in (
                    _withoutStopWords(par) for par in paragraphs
                )
        ]

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

    def best(self, top=1, dropOff=None, count=None, byteCount=None ):
        """ Finds and returns up to `top' best slices ordered by decreasing score. """

        if count is None and byteCount is None:
            return [range(self.paragraphs)]

        if count is None:
            count = len(self.paragraphs)

        def pairwiseMultiples(x, combine):
            mult = 1
            yield x
            while 2*mult <= count:
                if x.shape[0] % 2 != 0:
                    x = np.resize( x, (x.shape[0]+1, x.shape[1]) )
                x = combine(x[::2], x[1::2])
                mult *= 2
                yield x

        vec_mults = list( pairwiseMultiples(self.paragraphs, np.maximum) ) # reduce=max

        def enumMultiples(r):
            start, end = r
            i = 0
            while start < end:
                if start & 1 or start+1 == end:
                    yield (i, start)
                    start += 1
                if end & 1 and start < end:
                    end -= 1
                    yield (i, end)
                start >>= 1
                end >>= 1
                i += 1

        score = lambda r: reduce( np.maximum, (vec_mults[i][j] for i,j in enumMultiples(r)) ).sum() # reduce=max, norm=L1

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

        return result, list( map( score, result ) ), self.paragraphs.tolist(), [q.lemma_.lower() for q in self.query]


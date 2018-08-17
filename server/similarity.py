import spacy, re
import numpy as np

from itertools import chain

nlp = spacy.load( 'en_core_web_md', disable=['parser', 'tagger', 'ner'] )

def _amplify( x, mean, sigma ):
    e = np.exp( (x-mean)**2 / (2*sigma**2) )
    return (e-1)/e

def _withoutStopWords( tokens ):
    """ .is_stop is still broken in spaCy :( """
    return (t for t in tokens if not t.lemma_ in nlp.Defaults.stop_words)

class SliceBySimilarityToQuery(Object):
    def __init__(self, paragraphs, query, reduce='max', norm='L1', amplify='positive-2-stdev'):
        amplify = re.fullmatch( r'(positive|both)-(\d+)-stdev', amplify )
        assert( amplify is not None )
        assert( reduce == 'max' )
        assert( norm == 'L1' )

        width = float( amplify[1] )
        amplify = \
            lambda x, mean, sigma: _amplify( x, mean, sigma*width ) \
                if amplify[0] == 'both' else \
            lambda x, mean, sigma: (_amplify( x, mean, sigma*width ) if x >= mean else 0)

        self.byte_counts = np.asarray( [ len(p) for p in paragraphs ], dtype=np.int32 )

        paragraphs = nlp.pipe( chain( (query,), paragraphs ) )
        query = tuple( _withoutStopWords( next(paragraphs) ) )

        # Build a row-of-columns array for faster processing
        paragraphs = np.asarray( [
            tuple(
                max( # reduce=max
                    q.similarity(p) if q.has_vector and p.has_vector else (
                        1.0 if q.lemma_ == p.lemma_ else 0.0
                    ) for p in _withoutStopWords(par)
                ) for q in query
            ) for par in paragraphs
        ], dtype=np.float32, order='F' )

        # Term-weight representation of paragraphs
        self.paragraphs = np.asarray( [
            amplify(
                paragraphs[:,i],
                np.mean( paragraphs[:,i] ),
                np.std( paragraphs[:,i] )
            ) if query[i].has_vector else paragraphs[:,i]
                for i in range(paragraphs.shape[1])
        ], order='C' )

        # Generalized IDFmax weighting
        counts = np.sum( self.paragraphs, 0 )
        self.paragraphs *= np.log( counts.max() / (1 + counts) )

    def best(self, top=1, dropOff=None, count=None, byteCount=None ):
        """ Finds and returns up to `top' best slices ordered by decreasing score. """

        if count is None and byteCount is None:
            return [range(self.paragraphs)]

        if count is None:
            count = len(self.paragraphs)

        def pairwiseMultiples(x, reduce):
            mult = 1
            yield x
            while 2*mult <= count:
                if x.shape[0] % 2 != 0:
                    np.resize( x, (x.shape[0]+1, x.shape[1]) )
                x = reduce(x[::2], x[1::2])
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
                while to < len(self.byte_counts) and (bc < 0 or bc+self.byte_counts[to]+1 <= byteCount):
                    bc += self.byte_counts[to]+1
                    to += 1

                yield (fr, to)

                if to == len(self.byte_counts):
                    break

                bc += self.byte_counts[to]+1
                to += 1

                while bc > byteCount and fr+1 < to:
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
                    max(start, s) if e >= start else s,
                    min(end, e) if s < end else e
                )
                    for s,e in q
                        if s < start or e > end
            ), key=score)

            result.append( next )

        return result, list( map( score, result ) )


"""Exhaustive counts of the two public examples and their exact card links."""
import itertools
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class CountingExamples(unittest.TestCase):
    def test_exhaustive(self):
        counts = [0, 0]
        for p in itertools.permutations('ABCDExyz'):
            pos = {v: p.index(v) for v in p}
            separated = all(abs(pos[a] - pos[b]) > 1 for a, b in [('x','y'),('x','z'),('y','z')])
            if separated and abs(pos['A'] - pos['x']) > 1:
                counts[0] += 1
            if separated and abs(pos['A'] - pos['B']) == 1:
                counts[1] += 1
        self.assertEqual(counts, [9600, 2880])

    def test_links_and_public_questions(self):
        chapter = json.loads((ROOT/'content/counting.json').read_text())
        self.assertEqual([q['id'] for q in chapter['questions']], ['Q1101', 'Q1102'])
        self.assertEqual([q['type_id'] for q in chapter['questions']], ['gap-restrictions']*2)
        cards = {c['title']:c['id'] for c in json.loads((ROOT/'content/knowledge.json').read_text())['cards']}
        links = json.loads((ROOT/'content/example-links.json').read_text())
        actual = {(r['card_id'], r['question_id']) for r in links if r['chapter_id'] == 'DEMO-11'}
        self.assertEqual(actual, {(cards[name],qid) for name in ('乘法原理','排列数的计算') for qid in ('Q1101','Q1102')})

if __name__ == '__main__':
    unittest.main()

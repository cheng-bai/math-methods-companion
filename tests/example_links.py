"""Regression gates for the reviewed public card/exercise mapping."""
import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from example_links import validate

ROOT = Path(__file__).resolve().parents[1]
load = lambda name: json.loads((ROOT / 'content' / name).read_text())


class ExampleLinks(unittest.TestCase):
    def setUp(self):
        self.links = load('example-links.json')
        self.knowledge = load('knowledge.json')
        self.demo = load('demo.json')

    def test_reviewed_mapping(self):
        validate(self.links, self.knowledge, self.demo)
        self.assertEqual({(r['card_id'], r['question_id']) for r in self.links},
                         {('k-3b22fa72', f'Q0{i}') for i in range(1, 6)} |
                         {('k-2889c7de', 'Q04'), ('k-2889c7de', 'Q05')})

    def test_reject_invalid_inputs(self):
        variants = [None, {}, [None], self.links + [self.links[0]]]
        for field, value in [('card_id', 'unknown'), ('question_id', 'Q999'),
                             ('focus', ''), ('focus', None), ('focus', []),
                             ('private_path', '/private/source'), ('url', 'https://example.com')]:
            rows = copy.deepcopy(self.links)
            rows[0][field] = value
            variants.append(rows)
        for rows in variants:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                validate(rows, self.knowledge, self.demo)

    def test_empty_links_allowed(self):
        validate([], self.knowledge, self.demo)


if __name__ == '__main__':
    unittest.main()

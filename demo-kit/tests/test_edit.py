import unittest

import demokit.edit as e

ONE = [(10.0, 22.0, "thinking")]
TWO = [(10.0, 22.0, "cooking"), (40.0, 52.0, "")]


class At(unittest.TestCase):
    def test_no_waits(self):
        self.assertEqual(e.at([], 6, 33.0), 33.0)

    def test_one_wait(self):
        self.assertEqual(e.at(ONE, 6, 5.0), 5.0)
        self.assertEqual(e.at(ONE, 6, 10.0), 10.0)
        self.assertAlmostEqual(e.at(ONE, 6, 16.0), 11.0)  # half way in: 1 s of 2
        self.assertAlmostEqual(e.at(ONE, 6, 22.0), 12.0)
        self.assertAlmostEqual(e.at(ONE, 6, 30.0), 20.0)  # 12 s become 2: 10 s off

    def test_two_waits(self):
        self.assertAlmostEqual(e.at(TWO, 6, 30.0), 20.0)
        self.assertAlmostEqual(e.at(TWO, 6, 46.0), 31.0)  # 10 s off, then 6 s of the second at 6x
        self.assertAlmostEqual(e.at(TWO, 6, 60.0), 60.0 - 20.0)


class Plates(unittest.TestCase):
    def test_wait_plates_and_captions(self):
        caps = [(5.0, "a", 1.8), (15.0, "inside", 1.8), (30.0, "b", 1.0)]
        got = e.plates(TWO, caps, 6)
        self.assertEqual([p[0] for p in got], ["▶▶ 6×  cooking", "▶▶ 6×", "a", "b"])
        self.assertAlmostEqual(got[0][1], 10.0)
        self.assertAlmostEqual(got[0][2], 12.0)
        self.assertAlmostEqual(got[1][1], 30.0)
        self.assertEqual(got[2][1:], (5.0, 6.8))
        self.assertAlmostEqual(got[3][1], 20.0)
        self.assertAlmostEqual(got[3][2], 21.0)

    def test_none(self):
        self.assertEqual(e.plates([], [], 6), [])


class Chapters(unittest.TestCase):
    def test_marks_and_text(self):
        marks = e.chapter_marks(ONE, [(0.0, "Start"), (30.0, "End")], 6)
        self.assertEqual([m[1] for m in marks], ["Start", "thinking, at 6×", "End"])
        self.assertAlmostEqual(marks[2][0], 20.0)
        text = e.chapters_text(marks, 40.0)
        self.assertTrue(text.startswith(";FFMETADATA1\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=10000\ntitle=Start\n"))
        self.assertIn("START=20000\nEND=40000\ntitle=End\n", text)

    def test_empty_label(self):
        self.assertEqual(e.chapter_marks([(1.0, 7.0, "")], [], 6)[0][1], "At 6×")


class Graph(unittest.TestCase):
    def graph(self, waits, audio):
        shown = e.plates(waits, [(3.0, "cap", 1.0)], 6)
        return e.filter_graph(waits, 6, audio, shown)

    def test_audio_on(self):
        g = self.graph(TWO, True)
        self.assertIn("[0:a]", g)
        self.assertIn("concat=n=5:v=1:a=1[vc][a]", g)
        self.assertEqual(g.count("atempo=2,atempo=3"), 2)
        self.assertIn("[0:v]trim=10.000:22.000,setpts=(PTS-STARTPTS)/6[v1]", g)
        self.assertIn("[0:v]trim=52.000,setpts=PTS-STARTPTS[v4]", g)

    def test_audio_off(self):
        g = self.graph(TWO, False)
        self.assertNotIn("[0:a]", g)
        self.assertNotIn("[a]", g)
        self.assertIn("concat=n=5:v=1:a=0[vc]", g)

    def test_no_waits(self):
        g = e.filter_graph([], 6, True, [])
        self.assertIn("concat=n=1:v=1:a=1[vc][a]", g)
        self.assertIn("[vc][1:v]overlay=x=80", g)  # the mark is input 1
        self.assertTrue(g.endswith("[v]"))

    def test_end_still(self):
        shown = e.plates(ONE, [], 6)
        plain = e.filter_graph(ONE, 6, True, shown)
        g = e.filter_graph(ONE, 6, True, shown, ("end.png", 3), (3840, 2400))
        self.assertIn("concat=n=4:v=1:a=1", g)  # three segments and the still
        self.assertIn("concat=n=3:v=1:a=1", plain)
        self.assertIn("[v2][a2][vS][aS]concat", g)
        self.assertIn("[3:v]scale=3840:2400", g)  # one plate, the mark, then the still
        self.assertIn("anullsrc", g)
        silent = e.filter_graph(ONE, 6, False, shown, ("end.png", 3), (3840, 2400))
        self.assertNotIn("anullsrc", silent)
        self.assertIn("[v2][vS]concat=n=4:v=1:a=0", silent)

    def test_plate_inputs(self):
        shown = e.plates(ONE, [(3.0, "cap", 1.0), (4.0, "cap", 1.0)], 6)
        self.assertEqual(e.plate_texts(shown), ["▶▶ 6×  thinking", "cap"])
        g = e.filter_graph(ONE, 6, True, shown)
        self.assertIn("[3:v]overlay=x=80", g)  # two plates, then the mark


if __name__ == "__main__":
    unittest.main()

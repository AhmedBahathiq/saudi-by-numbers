PRAGMA foreign_keys = ON;
CREATE TABLE rounds (
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL, bank_version TEXT NOT NULL,
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT, score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 3)
);
CREATE INDEX rounds_event_created ON rounds(event_id, created_at);
CREATE TABLE answers (
  round_id TEXT NOT NULL REFERENCES rounds(id), position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 2),
  question_id TEXT NOT NULL, selected INTEGER NOT NULL CHECK(selected BETWEEN 0 AND 2),
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(round_id, position)
);
CREATE TABLE votes (
  round_id TEXT PRIMARY KEY REFERENCES rounds(id), city TEXT NOT NULL CHECK(city IN ('جدة','الرياض','العلا','أبها','المدينة المنورة','الخبر')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE event_totals (event_id TEXT PRIMARY KEY, completed INTEGER NOT NULL DEFAULT 0, score_sum INTEGER NOT NULL DEFAULT 0);
CREATE TABLE score_totals (event_id TEXT NOT NULL, score INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(event_id,score));
CREATE TABLE question_totals (event_id TEXT NOT NULL, question_id TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, choice0 INTEGER NOT NULL DEFAULT 0, choice1 INTEGER NOT NULL DEFAULT 0, choice2 INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(event_id,question_id));
CREATE TABLE poll_totals (event_id TEXT NOT NULL, city TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(event_id,city));

CREATE TRIGGER answer_added AFTER INSERT ON answers BEGIN
  INSERT INTO question_totals(event_id, question_id, total, correct, choice0, choice1, choice2)
    VALUES ((SELECT event_id FROM rounds WHERE id=NEW.round_id), NEW.question_id, 1, NEW.is_correct, NEW.selected=0, NEW.selected=1, NEW.selected=2)
    ON CONFLICT(event_id, question_id) DO UPDATE SET total=total+1, correct=correct+NEW.is_correct,
      choice0=choice0+(NEW.selected=0), choice1=choice1+(NEW.selected=1), choice2=choice2+(NEW.selected=2);
  UPDATE rounds SET score=score+NEW.is_correct,
    completed_at=CASE WHEN (SELECT COUNT(*) FROM answers WHERE round_id=NEW.round_id)=3 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END
    WHERE id=NEW.round_id AND completed_at IS NULL;
END;
CREATE TRIGGER round_completed AFTER UPDATE OF completed_at ON rounds WHEN OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL BEGIN
  INSERT INTO event_totals(event_id,completed,score_sum) VALUES(NEW.event_id,1,NEW.score)
    ON CONFLICT(event_id) DO UPDATE SET completed=completed+1, score_sum=score_sum+NEW.score;
  INSERT INTO score_totals(event_id,score,count) VALUES(NEW.event_id,NEW.score,1)
    ON CONFLICT(event_id,score) DO UPDATE SET count=count+1;
END;
CREATE TRIGGER vote_added AFTER INSERT ON votes BEGIN
  INSERT INTO poll_totals(event_id,city,count) VALUES((SELECT event_id FROM rounds WHERE id=NEW.round_id),NEW.city,1)
    ON CONFLICT(event_id,city) DO UPDATE SET count=count+1;
END;

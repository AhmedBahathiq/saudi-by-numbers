-- Additive: the legacy 0..3 round tables and their aggregates stay intact.
CREATE TABLE map_rounds (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  player_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bank_version TEXT NOT NULL,
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at = started_at + 60000),
  completed_at INTEGER,
  active_city TEXT,
  score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100 AND score % 10 = 0),
  answer_count INTEGER NOT NULL DEFAULT 0 CHECK(answer_count BETWEEN 0 AND 10),
  last_correct_at INTEGER
);
CREATE INDEX map_expiry ON map_rounds(event_id, expires_at) WHERE completed_at IS NULL;
CREATE INDEX map_player_rounds ON map_rounds(event_id, player_key);
CREATE TABLE map_answers (
  round_id TEXT NOT NULL REFERENCES map_rounds(id),
  city_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected INTEGER NOT NULL CHECK(selected BETWEEN 0 AND 2),
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)),
  received_at INTEGER NOT NULL,
  PRIMARY KEY(round_id,city_id)
);
CREATE TABLE map_best (
  event_id TEXT NOT NULL, player_key TEXT NOT NULL, display_name TEXT NOT NULL,
  round_id TEXT NOT NULL REFERENCES map_rounds(id), score INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL, achieved_at INTEGER NOT NULL,
  PRIMARY KEY(event_id,player_key)
);
CREATE INDEX map_ranking ON map_best(event_id,score DESC,elapsed_ms ASC,achieved_at ASC,player_key);
CREATE TABLE map_totals (event_id TEXT PRIMARY KEY, completed INTEGER NOT NULL DEFAULT 0, score_sum INTEGER NOT NULL DEFAULT 0);
CREATE TABLE map_score_totals (event_id TEXT NOT NULL,score INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(event_id,score));
CREATE TABLE map_city_totals (event_id TEXT NOT NULL,city_id TEXT NOT NULL,total INTEGER NOT NULL,correct INTEGER NOT NULL,PRIMARY KEY(event_id,city_id));
CREATE TABLE map_votes (
  round_id TEXT PRIMARY KEY REFERENCES map_rounds(id),
  city TEXT NOT NULL CHECK(city IN ('جدة','الرياض','العلا','أبها','المدينة المنورة','الخبر'))
);
CREATE TABLE map_poll_totals (event_id TEXT NOT NULL,city TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(event_id,city));

CREATE TRIGGER map_answer_guard BEFORE INSERT ON map_answers
WHEN NOT EXISTS (SELECT 1 FROM map_answers WHERE round_id=NEW.round_id AND city_id=NEW.city_id)
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM map_rounds WHERE id=NEW.round_id AND completed_at IS NULL
    AND active_city=NEW.city_id AND NEW.received_at>=started_at AND NEW.received_at<expires_at
  ) THEN RAISE(ABORT,'round_closed_or_city_not_active') END;
END;
CREATE TRIGGER map_answer_saved AFTER INSERT ON map_answers
BEGIN
  UPDATE map_rounds SET
    score=score+10*NEW.is_correct, answer_count=answer_count+1, active_city=NULL,
    last_correct_at=CASE WHEN NEW.is_correct=1 THEN NEW.received_at ELSE last_correct_at END,
    completed_at=CASE WHEN answer_count=9 THEN NEW.received_at ELSE completed_at END
  WHERE id=NEW.round_id;
  INSERT INTO map_city_totals(event_id,city_id,total,correct)
    SELECT event_id,NEW.city_id,1,NEW.is_correct FROM map_rounds WHERE id=NEW.round_id
    ON CONFLICT(event_id,city_id) DO UPDATE SET total=total+1,correct=correct+excluded.correct;
END;
CREATE TRIGGER map_round_completed AFTER UPDATE OF completed_at ON map_rounds
WHEN OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL
BEGIN
  INSERT INTO map_totals VALUES(NEW.event_id,1,NEW.score)
    ON CONFLICT(event_id) DO UPDATE SET completed=completed+1,score_sum=score_sum+excluded.score_sum;
  INSERT INTO map_score_totals VALUES(NEW.event_id,NEW.score,1)
    ON CONFLICT(event_id,score) DO UPDATE SET count=count+1;
  INSERT INTO map_best(event_id,player_key,display_name,round_id,score,elapsed_ms,achieved_at)
    VALUES(NEW.event_id,NEW.player_key,NEW.display_name,NEW.id,NEW.score,
      CASE WHEN NEW.score=0 THEN 60000 ELSE NEW.last_correct_at-NEW.started_at END,
      COALESCE(NEW.last_correct_at,NEW.completed_at))
    ON CONFLICT(event_id,player_key) DO UPDATE SET
      display_name=excluded.display_name,round_id=excluded.round_id,score=excluded.score,
      elapsed_ms=excluded.elapsed_ms,achieved_at=excluded.achieved_at
    WHERE excluded.score>map_best.score OR (excluded.score=map_best.score AND
      (excluded.elapsed_ms<map_best.elapsed_ms OR (excluded.elapsed_ms=map_best.elapsed_ms AND excluded.achieved_at<map_best.achieved_at)));
END;
CREATE TRIGGER map_vote_saved AFTER INSERT ON map_votes
BEGIN
  INSERT INTO map_poll_totals SELECT event_id,NEW.city,1 FROM map_rounds WHERE id=NEW.round_id
    ON CONFLICT(event_id,city) DO UPDATE SET count=count+1;
END;

"""Plain-python tests (no pytest needed):  venv/Scripts/python.exe tests/test_summarizer_guard.py
Covers the AI guardrail and the fallback path with no Ollama running."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai import summarizer  # noqa: E402

INC = {"title": "Multi-stage activity - dc-01", "primary_host": "dc-01", "primary_user": "u",
       "start_time": "t0", "end_time": "t1", "alert_count": 3, "risk_score": 80, "risk_level": "Critical",
       "mitre_techniques": ["T1003", "T1021"], "kill_chain_stages": ["Credential Access", "Lateral Movement"]}


def test_grounded_ok():
    assert summarizer.is_grounded("Observed T1003 then T1021.", INC)
    assert summarizer.is_grounded("No codes mentioned.", INC)


def test_invented_technique_rejected():
    assert not summarizer.is_grounded("Observed T1003 and T1186.", INC)
    assert not summarizer.is_grounded("Sub-technique T1059.001 seen.", INC)


def test_falls_back_when_model_invents_technique():
    summarizer.ollama_brief = lambda inc: "Attacker used T1220 to persist."
    out = summarizer.summarize(INC)
    assert "T1220" not in out and "Techniques: T1003, T1021" in out


def test_falls_back_when_model_unavailable():
    def boom(inc): raise ConnectionError("ollama down")
    summarizer.ollama_brief = boom
    assert summarizer.summarize(INC).startswith("Critical - ")


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)

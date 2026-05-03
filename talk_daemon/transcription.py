from __future__ import annotations

from faster_whisper import WhisperModel


class WhisperEngine:
    def __init__(
        self,
        model_name: str = "small.en",
        device: str = "auto",
        compute_type: str = "int8",
    ) -> None:
        self.model_name = model_name
        self.model = WhisperModel(model_name, device=device, compute_type=compute_type)

    def transcribe(self, samples, language: str = "en") -> dict[str, str]:
        segments, info = self.model.transcribe(
            samples,
            language=language,
            vad_filter=True,
            beam_size=1,
            word_timestamps=False,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        detected_language = getattr(info, "language", language)
        return {"text": text, "language": detected_language}

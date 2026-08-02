from pathlib import Path

FOLDER = "sound"

folder = Path(FOLDER)

with open("output.txt", "w", encoding="utf-8") as f:
    for file in sorted(folder.rglob("*")):
        if file.is_file():
            f.write(f'["{file.as_posix()}", ""],\n')

print("완료! output.txt 생성됨")
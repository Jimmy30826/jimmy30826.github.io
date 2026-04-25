import pyautogui
import time

# --- 설정 ---
INTERVAL = 0.7  # 반복 간격 (초 단위로 수정 가능)
pyautogui.PAUSE = 0.1
# -----------

print("1초 후 매크로를 시작합니다. 입력할 창을 클릭해 주세요.")
time.sleep(0.5)
print("매크로 실행 중... (중단하려면 Ctrl+C 또는 마우스를 화면 모서리로 이동)")

try:
    while True:
        # 1. Ctrl + V 실행 (붙여넣기)
        pyautogui.hotkey('ctrl', 'v')
        
        # 2. Enter 입력
        pyautogui.press('enter')
        
        print(f"[{time.strftime('%H:%M:%S')}] 붙여넣기 및 엔터 완료")
        
        # 3. 지정된 시간만큼 대기
        time.sleep(INTERVAL)

except KeyboardInterrupt:
    print("\n사용자에 의해 종료되었습니다.")
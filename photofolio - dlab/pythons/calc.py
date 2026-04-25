def calculator():
    print("간단한 계산기")
    
    operator = input("연산자를 선택하세요 (+, -, *, /): ")

    if operator not in ('+', '-', '*', '/'):
        print("잘못된 연산자입니다.")
        return

    try:
        num1 = float(input("첫 번째 수를 입력하세요: "))
        num2 = float(input("두 번째 수를 입력하세요: "))
    except ValueError:
        print("숫자를 입력해야 합니다.")
        return

    if operator == '+':
        result = num1 + num2
    elif operator == '-':
        result = num1 - num2
    elif operator == '*':
        result = num1 * num2
    elif operator == '/':
        if num2 == 0:
            print("0으로 나눌 수 없습니다.")
            return
        result = num1 / num2

    print(f"결과: {num1} {operator} {num2} = {result}")

if __name__ == "__main__":
    calculator()

import os, string

def get_strings(filepath, min_len=4):
    with open(filepath, 'rb') as f:
        data = f.read()
    strings = []
    current_string = ''
    for char in data:
        try:
            c = bytes([char]).decode('utf-8')
            if c in string.printable and c not in '\r\n\t ':
                current_string += c
            else:
                if len(current_string) >= min_len:
                    strings.append(current_string)
                current_string = ''
        except:
            if len(current_string) >= min_len:
                strings.append(current_string)
            current_string = ''
            
    if len(current_string) >= min_len:
        strings.append(current_string)
    return set(strings)

logo_dir = r"C:\Users\redsu\OneDrive\문서\바탕 화면\antigravity\mygame\logo"
files = os.listdir(logo_dir)
for f in files:
    s = get_strings(os.path.join(logo_dir, f))
    # Filter junk
    keywords = [x for x in s if len(x) > 4 and '<path' not in x and '<svg' not in x and 'xmlns' not in x and len(x) < 25]
    print(f"{f} : {keywords[:30]}")

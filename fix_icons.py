import os
from PIL import Image

def convert_to_png(file_path):
    try:
        with Image.open(file_path) as img:
            # Check if it's already a PNG with valid signature
            if img.format == 'PNG':
                print(f"File {file_path} is already a PNG.")
                return
            
            print(f"Converting {file_path} (Format: {img.format}) to real PNG...")
            img.save(file_path, 'PNG')
            print(f"Successfully converted {file_path}")
    except Exception as e:
        print(f"Error converting {file_path}: {e}")

def process_res_folder(res_path):
    for root, dirs, files in os.walk(res_path):
        for file in files:
            if file == 'ic_launcher.png' or file == 'ic_launcher_round.png':
                full_path = os.path.join(root, file)
                convert_to_png(full_path)

if __name__ == "__main__":
    res_dir = r"C:\RallyRing\frontend\android\app\src\main\res"
    process_res_folder(res_dir)

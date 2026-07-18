from PIL import Image
import os

assets_dir = 'mobile/assets'
for root, dirs, files in os.walk(assets_dir):
    for file in files:
        if file.lower().endswith('.png'):
            path = os.path.join(root, file)
            try:
                img = Image.open(path)
                
                # Create a fresh new image with same mode and size to discard metadata
                clean_img = Image.new(img.mode, img.size)
                clean_img.putdata(list(img.getdata()))
                
                # Save the fresh image back, stripping all info
                clean_img.save(path, 'PNG')
                print(f"Successfully stripped metadata from: {path}")
            except Exception as e:
                print(f"Failed to strip metadata from {path}: {e}")

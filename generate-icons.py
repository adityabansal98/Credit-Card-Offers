#!/usr/bin/env python3
"""
Generate icons for the Amex Offers Extractor browser extension.
Requires PIL/Pillow: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow is required. Install it with: pip install Pillow")
    exit(1)

import os

def create_icon(size):
    """Create an icon of the specified size."""
    # Create image with gradient background
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)
    
    # Draw gradient effect (simplified)
    for i in range(size):
        ratio = i / size
        r = int(102 + (118 - 102) * ratio)  # 667eea to 764ba2
        g = int(126 + (75 - 126) * ratio)
        b = int(234 + (162 - 234) * ratio)
        draw.rectangle([(0, i), (size, i+1)], fill=(r, g, b))
    
    # Draw card shape
    card_width = int(size * 0.7)
    card_height = int(size * 0.45)
    card_x = (size - card_width) // 2
    card_y = (size - card_height) // 2
    
    # Draw white card
    draw.rectangle([card_x, card_y, card_x + card_width, card_y + card_height], 
                   fill='white', outline='white', width=max(1, size // 20))
    
    # Draw lines on card
    line_y1 = card_y + int(size * 0.15)
    line_y2 = card_y + int(size * 0.25)
    line_width = int(card_width * 0.6)
    line_height = max(1, int(size * 0.05))
    
    draw.rectangle([card_x + int(size * 0.1), line_y1, 
                   card_x + int(size * 0.1) + line_width, line_y1 + line_height], 
                   fill='#667eea')
    
    draw.rectangle([card_x + int(size * 0.1), line_y2, 
                   card_x + int(size * 0.1) + int(card_width * 0.4), line_y2 + line_height], 
                   fill='#667eea')
    
    # Draw dollar sign
    try:
        font_size = int(size * 0.3)
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
    
    text = "$"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (size - text_width) // 2
    text_y = card_y + card_height + int(size * 0.05)
    
    draw.text((text_x, text_y), text, fill='#28a745', font=font)
    
    return img

def main():
    """Generate all required icon sizes."""
    icons_dir = 'icons'
    os.makedirs(icons_dir, exist_ok=True)
    
    sizes = [16, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        filename = f'{icons_dir}/icon{size}.png'
        icon.save(filename)
        print(f'Created {filename} ({size}x{size})')
    
    print(f'\nAll icons generated in {icons_dir}/ directory!')

if __name__ == '__main__':
    main()


"""
Netlify Function: Process image with OpenCV filters
POST /api/process

Accepts multipart form data with:
- file: image file
- type: 'posterize' | 'edges' | 'blur' | 'threshold'
- param_value: int (meaning depends on type)

Returns: processed image as PNG
"""

import json
import base64
import cv2
import numpy as np


def handler(event, context):
    """Netlify Function handler."""
    
    # Only accept POST
    if event.get('httpMethod') != 'POST':
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Parse multipart form data
        content_type = event.get('headers', {}).get('content-type', '')
        
        if 'multipart/form-data' not in content_type:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Expected multipart/form-data'})
            }
        
        # Decode base64 body if needed
        body = event.get('body', '')
        is_base64 = event.get('isBase64Encoded', False)
        
        if is_base64:
            body = base64.b64decode(body)
        else:
            body = body.encode('utf-8')
        
        # Parse multipart (simplified - extract image and params)
        boundary = content_type.split('boundary=')[-1].encode()
        parts = body.split(b'--' + boundary)
        
        image_data = None
        filter_type = 'posterize'
        param_value = 4
        
        for part in parts:
            if b'name="file"' in part or b'name="image"' in part:
                # Extract image data after headers
                header_end = part.find(b'\r\n\r\n')
                if header_end != -1:
                    image_data = part[header_end + 4:].rstrip(b'\r\n--')
            elif b'name="type"' in part:
                header_end = part.find(b'\r\n\r\n')
                if header_end != -1:
                    filter_type = part[header_end + 4:].rstrip(b'\r\n--').decode().strip()
            elif b'name="param_value"' in part:
                header_end = part.find(b'\r\n\r\n')
                if header_end != -1:
                    try:
                        param_value = int(part[header_end + 4:].rstrip(b'\r\n--').decode().strip())
                    except ValueError:
                        pass
        
        if image_data is None:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No image provided'})
            }
        
        # Decode image
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid image data'})
            }
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply filter based on type
        if filter_type == 'posterize':
            levels = max(2, min(8, param_value))
            factor = 256 // levels
            result = (gray // factor) * factor
            
        elif filter_type == 'edges':
            threshold = max(0, min(255, param_value))
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, threshold, threshold * 2)
            result = cv2.bitwise_not(edges)  # Invert: black lines on white
            
        elif filter_type == 'blur':
            radius = max(1, min(21, param_value))
            if radius % 2 == 0:
                radius += 1  # Must be odd
            result = cv2.GaussianBlur(gray, (radius, radius), 0)
            
        elif filter_type == 'threshold':
            cutoff = max(0, min(255, param_value))
            _, result = cv2.threshold(gray, cutoff, 255, cv2.THRESH_BINARY)
            
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown filter type: {filter_type}'})
            }
        
        # Encode result as PNG
        _, buffer = cv2.imencode('.png', result)
        result_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'image/png',
                'Access-Control-Allow-Origin': '*'
            },
            'body': result_base64,
            'isBase64Encoded': True
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


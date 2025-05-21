from flask import Flask, render_template, request, jsonify, send_file
from datetime import datetime, timedelta
import json
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import locale

app = Flask(__name__)

# Set Polish locale
locale.setlocale(locale.LC_ALL, 'pl_PL.UTF-8')

# Register fonts
pdfmetrics.registerFont(TTFont('DejaVuSans', 'fonts/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', 'fonts/DejaVuSans-Bold.ttf'))

# Ensure uploads directory exists
UPLOADS_DIR = 'uploads'
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)

def validate_nip(nip):
    """Validate Polish NIP number"""
    nip = ''.join(filter(str.isdigit, nip))
    if len(nip) != 10:
        return False
    
    weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    checksum = sum(int(nip[i]) * weights[i] for i in range(9))
    return (checksum % 11) == int(nip[9])

def number_to_words(number):
    """Convert number to Polish words"""
    units = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć']
    teens = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 
             'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście']
    tens = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 
            'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt']
    hundreds = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 
                'sześćset', 'siedemset', 'osiemset', 'dziewięćset']
    
    def convert_group(n):
        if n == 0:
            return ''
        result = ''
        if n >= 100:
            result += hundreds[n // 100] + ' '
            n %= 100
        if n >= 20:
            result += tens[n // 10] + ' '
            n %= 10
        elif n >= 10:
            result += teens[n - 10] + ' '
            return result
        if n > 0:
            result += units[n] + ' '
        return result

    if number == 0:
        return 'zero'
    
    result = ''
    if number >= 1000000:
        millions = number // 1000000
        result += convert_group(millions) + 'milionów '
        number %= 1000000
    if number >= 1000:
        thousands = number // 1000
        result += convert_group(thousands) + 'tysięcy '
        number %= 1000
    if number > 0:
        result += convert_group(number)
    
    return result.strip()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    try:
        data = request.json
        
        # Validate NIP numbers if provided
        if data.get('seller_has_nip') and not validate_nip(data.get('seller_nip', '')):
            return jsonify({'error': 'Nieprawidłowy numer NIP sprzedawcy'}), 400
        if data.get('buyer_has_nip') and not validate_nip(data.get('buyer_nip', '')):
            return jsonify({'error': 'Nieprawidłowy numer NIP nabywcy'}), 400

        # Create PDF
        filename = f"faktura_{data['invoice_number']}.pdf"
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        doc = SimpleDocTemplate(
            filepath,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        styles = getSampleStyleSheet()
        styles['Heading1'].fontName = 'DejaVuSans-Bold'
        styles['Normal'].fontName = 'DejaVuSans'
        elements = []
        
        # Add header
        elements.append(Paragraph(f"{'Faktura VAT' if data.get('is_vat') else 'Rachunek'} {data['invoice_number']}", 
                                styles['Heading1']))
        elements.append(Spacer(1, 10*mm))
        
        # Add dates
        elements.append(Paragraph(f"Data wystawienia: {data['issue_date']}", styles['Normal']))
        elements.append(Paragraph(f"Data płatności: {data['due_date']}", styles['Normal']))
        elements.append(Spacer(1, 5*mm))
        
        # Add seller and buyer info
        seller_info = [
            ['Sprzedawca:', data['seller_name']],
            ['Adres:', data['seller_address']]
        ]
        if data.get('seller_has_nip'):
            seller_info.append(['NIP:', data['seller_nip']])
        
        buyer_info = [
            ['Nabywca:', data['buyer_name']],
            ['Adres:', data['buyer_address']]
        ]
        if data.get('buyer_has_nip'):
            buyer_info.append(['NIP:', data['buyer_nip']])
        
        # Create tables for seller and buyer info
        seller_table = Table(seller_info, colWidths=[30*mm, 100*mm])
        buyer_table = Table(buyer_info, colWidths=[30*mm, 100*mm])
        
        elements.append(seller_table)
        elements.append(Spacer(1, 10*mm))
        elements.append(buyer_table)
        elements.append(Spacer(1, 10*mm))
        
        # Add items table
        items_data = [['Lp.', 'Nazwa', 'Ilość', 'Cena', 'Wartość']]
        if data.get('is_vat'):
            items_data[0].extend(['Stawka VAT', 'Kwota VAT', 'Wartość brutto'])
        
        total_net = 0
        total_vat = 0
        total_gross = 0
        
        for i, item in enumerate(data['items'], 1):
            quantity = float(item['quantity'])
            price = float(item['price'])
            net_value = quantity * price
            vat_rate = 0.23 if data.get('is_vat') else 0
            vat_amount = net_value * vat_rate
            gross_value = net_value + vat_amount
            
            row = [str(i), item['description'], f"{quantity:.2f}", f"{price:.2f}", f"{net_value:.2f}"]
            if data.get('is_vat'):
                row.extend([f"{vat_rate*100}%", f"{vat_amount:.2f}", f"{gross_value:.2f}"])
            
            items_data.append(row)
            
            total_net += net_value
            total_vat += vat_amount
            total_gross += gross_value
        
        # Add totals row
        totals_row = ['', '', '', '', f"{total_net:.2f}"]
        if data.get('is_vat'):
            totals_row.extend([f"{total_vat:.2f}", f"{total_gross:.2f}"])
        items_data.append(totals_row)
        
        items_table = Table(items_data, colWidths=[10*mm, 60*mm, 20*mm, 20*mm, 25*mm])
        items_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -2), 1, colors.black),
            ('LINEBELOW', (0, -2), (-1, -2), 1, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'DejaVuSans-Bold'),
        ]))
        
        elements.append(items_table)
        elements.append(Spacer(1, 10*mm))
        
        # Add amount in words
        elements.append(Paragraph(f"Słownie: {number_to_words(int(total_gross))} złotych", styles['Normal']))
        
        # Add payment info
        elements.append(Spacer(1, 10*mm))
        elements.append(Paragraph(f"Sposób płatności: {data['payment_method']}", styles['Normal']))
        if data['payment_method'] == 'przelew':
            elements.append(Paragraph(f"Numer konta: {data.get('seller_bank_account', '')}", styles['Normal']))
            if data.get('seller_bank_name'):
                elements.append(Paragraph(f"Bank: {data['seller_bank_name']}", styles['Normal']))
        
        # Build PDF
        doc.build(elements)
        
        return send_file(filepath, as_attachment=True)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save_template', methods=['POST'])
def save_template():
    try:
        data = request.json
        template_name = data.pop('template_name')
        
        templates = {}
        if os.path.exists('templates.json'):
            with open('templates.json', 'r', encoding='utf-8') as f:
                templates = json.load(f)
        
        templates[template_name] = data
        
        with open('templates.json', 'w', encoding='utf-8') as f:
            json.dump(templates, f, ensure_ascii=False, indent=2)
        
        return jsonify({'message': 'Szablon zapisany pomyślnie'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/load_templates', methods=['GET'])
def load_templates():
    try:
        if os.path.exists('templates.json'):
            with open('templates.json', 'r', encoding='utf-8') as f:
                templates = json.load(f)
            return jsonify(templates)
        return jsonify({})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
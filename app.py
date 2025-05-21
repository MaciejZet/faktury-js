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
            topMargin=15*mm,
            bottomMargin=20*mm
        )
        
        # Define styles
        styles = getSampleStyleSheet()
        styles['Heading1'].fontName = 'DejaVuSans-Bold'
        styles['Heading1'].alignment = 1  # Center alignment
        styles['Heading1'].fontSize = 16
        styles['Heading1'].spaceAfter = 10

        styles['Normal'].fontName = 'DejaVuSans'
        styles['Normal'].fontSize = 10
        styles['Normal'].leading = 14

        header_style = ParagraphStyle(
            'Header',
            parent=styles['Normal'],
            fontName='DejaVuSans-Bold',
            fontSize=9,
            alignment=2,  # Right alignment
        )
        
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=18,
            alignment=1,  # Center alignment
            spaceAfter=5*mm,
        )
        
        label_style = ParagraphStyle(
            'Label',
            parent=styles['Normal'],
            fontName='DejaVuSans-Bold',
            fontSize=10,
            alignment=0,  # Left alignment
        )
        
        total_style = ParagraphStyle(
            'Total',
            parent=styles['Normal'],
            fontName='DejaVuSans-Bold',
            fontSize=10,
            alignment=2,  # Right alignment
        )

        elements = []
        
        # Create top section with invoice title and dates
        today = datetime.now().strftime('%d.%m.%Y')
        place = data.get('place_of_issue', 'Wrocław')  # Default to Wrocław if not provided

        # Header table with logo placeholder and dates
        header_data = [
            ['', Paragraph(f"Miejsce wystawienia: {place}", header_style)],
            ['', Paragraph(f"Data wystawienia: {data['issue_date']}", header_style)],
            ['', Paragraph(f"Data płatności: {data['due_date']}", header_style)]
        ]
        header_table = Table(header_data, colWidths=[100*mm, 70*mm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 5*mm))
        
        # Add centered title
        title = f"{'FAKTURA VAT' if data.get('is_vat') else 'RACHUNEK'} {data['invoice_number']}"
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 5*mm))
        
        # Create seller and buyer info in two columns
        seller_info = [
            [Paragraph('Sprzedawca:', label_style)],
            [Paragraph(data['seller_name'], styles['Normal'])],
            [Paragraph(data['seller_address'], styles['Normal'])]
        ]
        
        if data.get('seller_has_nip'):
            seller_info.append([Paragraph(f"NIP: {data['seller_nip']}", styles['Normal'])])
        
        buyer_info = [
            [Paragraph('Nabywca:', label_style)],
            [Paragraph(data['buyer_name'], styles['Normal'])],
            [Paragraph(data['buyer_address'], styles['Normal'])]
        ]
        
        if data.get('buyer_has_nip'):
            buyer_info.append([Paragraph(f"NIP: {data['buyer_nip']}", styles['Normal'])])
        
        # Make both columns the same height
        max_rows = max(len(seller_info), len(buyer_info))
        while len(seller_info) < max_rows:
            seller_info.append([''])
        while len(buyer_info) < max_rows:
            buyer_info.append([''])
        
        # Create parties table (side-by-side columns)
        parties_data = []
        for i in range(max_rows):
            parties_data.append([seller_info[i][0], buyer_info[i][0]])
            
        parties_table = Table(parties_data, colWidths=[85*mm, 85*mm])
        parties_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (0, -1), 10),
            ('LEFTPADDING', (1, 0), (1, -1), 10),
        ]))
        elements.append(parties_table)
        elements.append(Spacer(1, 10*mm))
        
        # Add items table with improved styling
        if data.get('is_vat'):
            col_widths = [10*mm, 50*mm, 15*mm, 20*mm, 20*mm, 15*mm, 20*mm, 20*mm]
            items_data = [['Lp.', 'Nazwa', 'Ilość', 'Cena netto', 'Wartość netto', 'VAT %', 'Kwota VAT', 'Wartość brutto']]
        else:
            col_widths = [10*mm, 80*mm, 15*mm, 20*mm, 45*mm]
            items_data = [['Lp.', 'Nazwa', 'Ilość', 'Cena', 'Wartość']]
        
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
            
            row = [str(i), item['description'], f"{quantity:.2f}", f"{price:.2f} zł", f"{net_value:.2f} zł"]
            if data.get('is_vat'):
                row.extend([f"{int(vat_rate*100)}%", f"{vat_amount:.2f} zł", f"{gross_value:.2f} zł"])
            
            items_data.append(row)
            
            total_net += net_value
            total_vat += vat_amount
            total_gross += gross_value
        
        # Add totals row
        if data.get('is_vat'):
            items_data.append(['', '', '', '', Paragraph('Razem:', total_style), '', f"{total_vat:.2f} zł", f"{total_gross:.2f} zł"])
            items_data.append(['', '', '', '', Paragraph('W tym:', styles['Normal']), '', '', ''])
            items_data.append(['', '', '', '', Paragraph('23% VAT:', styles['Normal']), '23%', f"{total_vat:.2f} zł", f"{total_gross:.2f} zł"])
        else:
            items_data.append(['', '', '', Paragraph('Razem:', total_style), f"{total_net:.2f} zł"])
        
        items_table = Table(items_data, colWidths=col_widths)
        items_table_style = [
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),      # Lp. centered
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),      # Quantity centered
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),        # Description left aligned
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),      # All amount columns right aligned
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),    # Middle vertical alignment
            ('GRID', (0, 0), (-1, -2), 0.5, colors.black),  # Thinner grid lines
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),  # Header background
            ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),  # Bold header
            ('FONTNAME', (0, -1), (-1, -1), 'DejaVuSans-Bold'),  # Bold totals
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]
        
        # Add special styling for the footer rows
        if data.get('is_vat'):
            items_table_style.extend([
                ('SPAN', (0, -3), (3, -3)),  # Span "Razem" across first four columns
                ('SPAN', (0, -2), (3, -2)),  # Span "W tym" across first four columns
                ('SPAN', (0, -1), (3, -1)),  # Span "23% VAT" across first four columns
                ('LINEBELOW', (0, -4), (-1, -4), 1, colors.black),
                ('LINEABOVE', (0, -3), (-1, -3), 1, colors.black),
                ('GRID', (0, -3), (-1, -1), 0, colors.white),  # Remove grid for footer rows
            ])
        else:
            items_table_style.extend([
                ('SPAN', (0, -1), (2, -1)),  # Span "Razem" across first three columns
                ('LINEBELOW', (0, -2), (-1, -2), 1, colors.black),
                ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
                ('GRID', (0, -1), (-1, -1), 0, colors.white),  # Remove grid for footer row
            ])
        
        items_table.setStyle(TableStyle(items_table_style))
        elements.append(items_table)
        elements.append(Spacer(1, 7*mm))
        
        # Add amount in words
        elements.append(Paragraph(f"Słownie: {number_to_words(int(total_gross))} złotych {int((total_gross % 1) * 100):02d}/100", styles['Normal']))
        
        # Add payment info
        elements.append(Spacer(1, 8*mm))
        
        payment_info = [
            [Paragraph('Sposób płatności:', label_style), Paragraph(data['payment_method'], styles['Normal'])]
        ]
        
        if data['payment_method'] == 'przelew':
            payment_info.append(
                [Paragraph('Numer konta:', label_style), Paragraph(data.get('seller_bank_account', ''), styles['Normal'])]
            )
            if data.get('seller_bank_name'):
                payment_info.append(
                    [Paragraph('Bank:', label_style), Paragraph(data['seller_bank_name'], styles['Normal'])]
                )
        
        payment_table = Table(payment_info, colWidths=[35*mm, 135*mm])
        payment_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(payment_table)
        
        # Add signature fields
        elements.append(Spacer(1, 20*mm))
        
        signature_data = [
            [Paragraph('Wystawił:', label_style), '', Paragraph('Odebrał:', label_style)],
            ['....................................', '', '....................................']
        ]
        signature_table = Table(signature_data, colWidths=[70*mm, 30*mm, 70*mm])
        signature_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(signature_table)
        
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
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
pdfmetrics.registerFont(TTFont('NunitoSans', 'fonts/NunitoSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NunitoSans-SemiBold', 'fonts/NunitoSans-SemiBold.ttf'))

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
        safe_invoice_number = data['invoice_number'].replace('/', '_')
        filename = f"faktura_{safe_invoice_number}.pdf"
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
        styles['Heading1'].fontName = 'NunitoSans-SemiBold'
        styles['Heading1'].alignment = 1  # Center alignment
        styles['Heading1'].fontSize = 18
        styles['Heading1'].spaceAfter = 12

        styles['Normal'].fontName = 'NunitoSans'
        styles['Normal'].fontSize = 10
        styles['Normal'].leading = 14
        
        # Styl do zawijania długich tekstów
        wrap_style = ParagraphStyle(
            'Wrap',
            parent=styles['Normal'],
            fontName='NunitoSans',
            fontSize=9,
            alignment=0,  # Left alignment
            leading=11,
        )

        header_label_style = ParagraphStyle(
            'HeaderLabel',
            parent=styles['Normal'],
            fontName='NunitoSans-SemiBold',
            fontSize=9,
            alignment=1,  # Center alignment
            textColor=colors.white,
        )

        header_value_style = ParagraphStyle(
            'HeaderValue',
            parent=styles['Normal'],
            fontName='NunitoSans',
            fontSize=10,
            alignment=1,  # Center alignment
            textColor=colors.HexColor('#333333'),
        )
        
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=20,
            alignment=1,  # Center alignment
            spaceAfter=2*mm,
            textColor=colors.HexColor('#333333'),
        )
        
        label_style = ParagraphStyle(
            'Label',
            parent=styles['Normal'],
            fontName='NunitoSans-SemiBold',
            fontSize=11,
            alignment=0,  # Left alignment
            textColor=colors.HexColor('#333333'),
        )
        
        total_style = ParagraphStyle(
            'Total',
            parent=styles['Normal'],
            fontName='NunitoSans-SemiBold',
            fontSize=11,
            alignment=2,  # Right alignment
            textColor=colors.HexColor('#333333'),
        )

        footnote_style = ParagraphStyle(
            'Footnote',
            parent=styles['Normal'],
            fontSize=8,
            alignment=0,  # Left alignment
            textColor=colors.HexColor('#666666'),
        )

        elements = []
        
        # Header tables for place and date of issue (right side, stacked)
        place = data.get('place_of_issue', 'Wrocław')
        place_table = Table([
            [Paragraph('Miejsce wystawienia', header_label_style)],
            [Paragraph(place, header_value_style)]
        ], colWidths=[55*mm])
        place_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#333333')),
            ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#F5F5F5')),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('VALIGN', (0, 0), (0, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (0, -1), 4),
            ('BOTTOMPADDING', (0, 0), (0, -1), 4),
            ('GRID', (0, 0), (0, 1), 0.5, colors.HexColor('#CCCCCC')),
        ]))
        date_table = Table([
            [Paragraph('Data wystawienia', header_label_style)],
            [Paragraph(data['issue_date'], header_value_style)]
        ], colWidths=[55*mm])
        date_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#333333')),
            ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#F5F5F5')),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('VALIGN', (0, 0), (0, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (0, -1), 4),
            ('BOTTOMPADDING', (0, 0), (0, -1), 4),
            ('GRID', (0, 0), (0, 1), 0.5, colors.HexColor('#CCCCCC')),
        ]))
        # Stack place and date tables vertically, align right
        right_header = Table(
            [[place_table], [Spacer(1, 2*mm)], [date_table]],
            colWidths=[55*mm]
        )
        right_header.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        # Add right_header to the top right, with empty space on left
        elements.append(Table([[None, right_header]], colWidths=[110*mm, 70*mm], style=TableStyle([('VALIGN', (1, 0), (1, 0), 'TOP')])))
        elements.append(Spacer(1, 8*mm))
        
        # Create separate tables for seller and buyer, side by side
        seller_type = data.get('seller_type', 'Sprzedawca')
        seller_type_capitalized = seller_type[0].upper() + seller_type[1:]
        
        seller_info = [
            [Paragraph(f'{seller_type_capitalized}:', ParagraphStyle('SellerHeader', parent=label_style, textColor=colors.white))],
            [Paragraph(data['seller_name'], styles['Normal'])],
            [Paragraph(data['seller_address'], styles['Normal'])]
        ]
        if data.get('seller_has_nip'):
            seller_info.append([Paragraph(f"NIP: {data['seller_nip']}", styles['Normal'])])
        else:
            if data.get('seller_pesel'):
                seller_info.append([Paragraph(f"PESEL: {data['seller_pesel']}", styles['Normal'])])
        seller_table = Table(seller_info, colWidths=[80*mm])
        seller_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#333333')),
            ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
            ('FONTNAME', (0, 0), (0, 0), 'NunitoSans-SemiBold'),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#F5F5F5')),
            ('GRID', (0, 0), (0, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('TOPPADDING', (0, 0), (0, -1), 4),
            ('BOTTOMPADDING', (0, 0), (0, -1), 4),
            ('LEFTPADDING', (0, 0), (0, -1), 4),
            ('RIGHTPADDING', (0, 0), (0, -1), 4),
        ]))
        
        buyer_type = data.get('buyer_type', 'Nabywca')
        buyer_type_capitalized = buyer_type[0].upper() + buyer_type[1:]
        
        buyer_info = [
            [Paragraph(f'{buyer_type_capitalized}:', ParagraphStyle('BuyerHeader', parent=label_style, textColor=colors.white))],
            [Paragraph(data['buyer_name'], styles['Normal'])],
            [Paragraph(data['buyer_address'], styles['Normal'])]
        ]
        if data.get('buyer_has_nip'):
            buyer_info.append([Paragraph(f"NIP: {data['buyer_nip']}", styles['Normal'])])
        buyer_table = Table(buyer_info, colWidths=[80*mm])
        buyer_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#333333')),
            ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
            ('FONTNAME', (0, 0), (0, 0), 'NunitoSans-SemiBold'),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#F5F5F5')),
            ('GRID', (0, 0), (0, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('TOPPADDING', (0, 0), (0, -1), 4),
            ('BOTTOMPADDING', (0, 0), (0, -1), 4),
            ('LEFTPADDING', (0, 0), (0, -1), 4),
            ('RIGHTPADDING', (0, 0), (0, -1), 4),
        ]))
        # Place seller and buyer tables side by side with a gap
        parties_row = Table([[buyer_table, None, seller_table]], colWidths=[80*mm, 10*mm, 80*mm])
        parties_row.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(parties_row)
        elements.append(Spacer(1, 6*mm))

        title = f"{'FAKTURA VAT' if data.get('is_vat') else 'FAKTURA'} {data['invoice_number']}"
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 6*mm))
        
        # Add items table with improved styling
        if data.get('is_vat'):
            col_widths = [10*mm, 60*mm, 15*mm, 15*mm, 20*mm, 20*mm, 15*mm, 20*mm, 20*mm]
            items_data = [['Lp.', 'Nazwa towaru lub usługi', 'J.m.', 'Ilość', 'Cena netto', 'Wartość netto', 'VAT %', 'Kwota VAT', 'Wartość brutto']]
        else:
            col_widths = [10*mm, 80*mm, 15*mm, 15*mm, 25*mm, 30*mm]
            items_data = [['Lp.', 'Nazwa towaru lub usługi', 'J.m.', 'Ilość', 'Cena', 'Wartość']]
        
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
              # Domyślna jednostka miary to "usł." jeśli nie podano
            unit = item.get('unit', 'usł.')
            
            # Zawijanie długiego tekstu i dodanie Paragraph do jednostki miary
            description = Paragraph(item['description'], wrap_style)
            unit_paragraph = Paragraph(unit, wrap_style)
            
            # Używanie Paragraph dla jednostki miary, aby polskie znaki wyświetlały się poprawnie
            row = [str(i), description, unit_paragraph, f"{quantity:.2f}", f"{price:.2f} PLN", f"{net_value:.2f} PLN"]
            if data.get('is_vat'):
                row.extend([f"{int(vat_rate*100)}%", f"{vat_amount:.2f} PLN", f"{gross_value:.2f} PLN"])
            
            items_data.append(row)
            
            total_net += net_value
            total_vat += vat_amount
            total_gross += gross_value
        
        # Add totals row
        if data.get('is_vat'):
            items_data.append(['', '', '', '', '', Paragraph('Razem:', total_style), '', f"{total_vat:.2f} PLN", f"{total_gross:.2f} PLN"])
            items_data.append(['', '', '', '', '', Paragraph('W tym:', styles['Normal']), '', '', ''])
            items_data.append(['', '', '', '', '', Paragraph('23% VAT:', styles['Normal']), '23%', f"{total_vat:.2f} PLN", f"{total_gross:.2f} PLN"])
        else:
            items_data.append(['', '', '', '', Paragraph('Razem:', total_style), f"{total_net:.2f} PLN"])
        
        items_table = Table(items_data, colWidths=col_widths)
        items_table_style = [
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (3, -1), 'CENTER'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('ALIGN', (4, 0), (4, -1), 'CENTER'),
            ('ALIGN', (5, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#CCCCCC')),  # Jaśniejsza siatka
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F5F5F5')),  # Jaśniejsze tło nagłówka
            ('FONTNAME', (0, 0), (-1, 0), 'NunitoSans-SemiBold'),
            ('FONTNAME', (0, -1), (-1, -1), 'NunitoSans-SemiBold'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]
        
        # Add special styling for the footer rows
        if data.get('is_vat'):
            items_table_style.extend([
                ('SPAN', (0, -3), (5, -3)),  # Span "Razem" across first columns
                ('SPAN', (0, -2), (5, -2)),  # Span "W tym" across first columns
                ('SPAN', (0, -1), (5, -1)),  # Span "23% VAT" across first columns
                ('LINEBELOW', (0, -4), (-1, -4), 1, colors.black),
                ('LINEABOVE', (0, -3), (-1, -3), 1, colors.black),
                ('GRID', (0, -3), (-1, -1), 0, colors.white),  # Remove grid for footer rows
            ])
        else:
            items_table_style.extend([
                ('SPAN', (0, -1), (4, -1)),  # Span "Razem" across first columns
                ('LINEBELOW', (0, -2), (-1, -2), 1, colors.black),
                ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
                ('GRID', (0, -1), (-1, -1), 0, colors.white),  # Remove grid for footer row
            ])
        
        items_table.setStyle(TableStyle(items_table_style))
        elements.append(items_table)
        elements.append(Spacer(1, 7*mm))
        
        # Add payment info with improved styling
        payment_data = []
        payment_data.append(['Sposób płatności:', data['payment_method']])
        
        if data['payment_method'] == 'przelew':
            payment_data.append(['Numer konta:', data.get('seller_bank_account', '')])
            if data.get('seller_bank_name'):
                payment_data.append(['Bank:', data['seller_bank_name']])
            payment_data.append(['Termin płatności:', data['due_date']])

        payment_table = Table(payment_data, colWidths=[40*mm, 130*mm])
        payment_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('FONTNAME', (0, 0), (0, -1), 'NunitoSans-SemiBold'),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F5F5F5')),
            ('LEFTPADDING', (0, 0), (0, -1), 4),
            ('RIGHTPADDING', (0, 0), (0, -1), 4),
            ('LEFTPADDING', (1, 0), (1, -1), 4),
            ('RIGHTPADDING', (1, 0), (1, -1), 4),
        ]))
        elements.append(payment_table)
        elements.append(Spacer(1, 10*mm))
        
        # Add "Do zapłaty" i "Słownie" w jednej tabeli z wyrównaniem do prawej
        final_amount = total_gross if data.get('is_vat') else total_net
        
        # Format kwoty słownie z groszami
        int_part = int(final_amount)
        decimal_part = int((final_amount % 1) * 100)
          # Użyj Paragraph dla tekstów w złotych słownie, aby poprawnie wyświetlać polskie znaki
        amount_in_words = f"{number_to_words(int_part)} {decimal_part:02d}/100 PLN"
        
        summary_data = [
            ['Do zapłaty:', Paragraph(f"{final_amount:.2f} PLN", wrap_style)],
            ['Słownie:', Paragraph(amount_in_words, wrap_style)]
        ]
        
        summary_table = Table(summary_data, colWidths=[30*mm, 70*mm])
        summary_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (0, -1), 'NunitoSans-SemiBold'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (0, -1), 0),
            ('RIGHTPADDING', (1, 0), (1, -1), 0),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F5F5F5')),
        ]))
        
        # Dodajemy do elementów z przesunięciem w prawo
        right_aligned_summary = Table([[None, summary_table]], colWidths=[70*mm, 100*mm])
        right_aligned_summary.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(right_aligned_summary)
        
        # Dodaj informację o zwolnieniu z VAT dla faktur bez VAT
        if not data.get('is_vat'):
            elements.append(Spacer(1, 5*mm))
            # Linia oddzielająca przed informacją prawną
            elements.append(Paragraph("<hr width='100%'/>", styles['Normal']))
            elements.append(Spacer(1, 2*mm))
            elements.append(Paragraph(
                "Przepis na podstawie którego stosowane jest zwolnienie od podatku (stawka VAT zw.): "
                "Zwolnienie ze względu na nieprzekroczenie 200 000 PLN obrotu (art. 113 ust 1 i 9 ustawy o VAT).",
                footnote_style
            ))
        
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
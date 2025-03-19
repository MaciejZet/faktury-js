document.addEventListener("DOMContentLoaded", () => {
    const invoiceForm = document.getElementById("invoiceForm");
    const itemsTableBody = document.getElementById("itemsTableBody");
    const addItemButton = document.getElementById("addItemButton");
    const generatePdfButton = document.getElementById("generatePdfButton");
    const invoicePreview = document.getElementById("invoicePreview");

    // Dodawanie nowej pozycji
    addItemButton.addEventListener("click", () => {
        const row = document.createElement("tr");
        row.classList.add("item-row");
        row.innerHTML = `
            <td><input type="text" class="item-description" placeholder="Opis" required></td>
            <td><input type="number" class="item-quantity" placeholder="Ilość" min="1" required></td>
            <td><input type="number" class="item-price" placeholder="Cena jedn." step="0.01" min="0" required></td>
            <td class="item-total">0.00</td>
            <td><button type="button" class="delete-item-btn">Usuń</button></td>
        `;
        itemsTableBody.appendChild(row);

        // Obsługa usuwania pozycji
        row.querySelector(".delete-item-btn").addEventListener("click", () => {
            row.remove();
            updatePreview();
        });

        // Aktualizacja podglądu przy zmianie danych
        row.querySelectorAll("input").forEach(input => {
            input.addEventListener("input", updatePreview);
        });

        // Dodawanie animacji przy dodawaniu pozycji
        row.style.animation = 'fadeIn 0.3s ease-out';
    });

    // Aktualizacja podglądu rachunku
    function updatePreview() {
        let totalSum = 0;
        const items = Array.from(itemsTableBody.querySelectorAll(".item-row")).map(row => {
            const description = row.querySelector(".item-description").value;
            const quantity = parseFloat(row.querySelector(".item-quantity").value) || 0;
            const price = parseFloat(row.querySelector(".item-price").value) || 0;
            const total = quantity * price;
            row.querySelector(".item-total").textContent = total.toFixed(2);
            totalSum += total;
            return { description, quantity, price, total };
        });

        const logo = localStorage.getItem('companyLogo');
        const logoHtml = logo ? `<img src="${logo}" class="company-logo" alt="Logo firmy">` : '';

        // Generowanie podglądu HTML
        invoicePreview.innerHTML = `
            <div class="invoice-header">
                <div></div>
                <div></div>
                <div>
                    <table class="invoice-meta">
                        <tr>
                            <td class="head">Miejsce wystawienia</td>
                        </tr>
                        <tr>
                            <td class="body">Wrocław</td>
                        </tr>
                        <tr><td></td></tr>
                        <tr>
                            <td class="head">Data wystawienia</td>
                        </tr>
                        <tr>
                            <td class="body">${formatDate(document.getElementById("issueDate").value)}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="parties-grid">
                <div class="invoice-party">
                    <div class="party-header">Nabywca</div>
                    <div class="party-details">
                        ${document.getElementById("buyerName").value}<br>
                        NIP: ${document.getElementById("buyerNIP").value}<br>
                        ${document.getElementById("buyerAddress").value}
                    </div>
                </div>
                <div class="invoice-party">
                    <div class="party-header">Sprzedawca</div>
                    <div class="party-details">
                        ${document.getElementById("sellerName").value}<br>
                        NIP: ${document.getElementById("sellerNIP").value}<br>
                        ${document.getElementById("sellerAddress").value}
                    </div>
                </div>
            </div>

            <div class="invoice-title">
                Faktura VAT ${document.getElementById("invoiceNumber").value}
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th width="5%">Lp.</th>
                        <th>Nazwa towaru lub usługi</th>
                        <th width="10%">J.m.</th>
                        <th width="8%">Ilość</th>
                        <th width="12%">Cena netto</th>
                        <th width="12%">Wartość netto</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => `
                        <tr>
                            <td align="center">${index + 1}</td>
                            <td align="left">${item.description}</td>
                            <td align="center">szt.</td>
                            <td align="center">${item.quantity}</td>
                            <td align="right">${formatAmount(item.price)}</td>
                            <td align="right">${formatAmount(item.total)}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td colspan="5" align="right">Razem:</td>
                        <td align="right">${formatAmount(totalSum)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="payment-info">
                <table class="payment-details">
                    <tr>
                        <td>Sposób płatności:</td>
                        <td>przelew</td>
                    </tr>
                    <tr>
                        <td>Termin płatności:</td>
                        <td>${formatDate(document.getElementById("dueDate").value)}</td>
                    </tr>
                </table>
            </div>

            <div class="signature-area">
                <div style="height: 60px;"></div>
                <div>Podpis osoby upoważnionej do wystawienia</div>
            </div>
        `;
    }

    // Walidacja NIP
    function validateNIP(nip) {
        const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        nip = nip.replace(/[^0-9]/g, '');
        
        if (nip.length !== 10) return false;
        
        let sum = 0;
        weights.forEach((weight, index) => {
            sum += weight * parseInt(nip[index]);
        });
        
        return (sum % 11) === parseInt(nip[9]);
    }

    // Formatowanie kwot
    function formatCurrency(amount) {
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: 'PLN'
        }).format(amount);
    }

    // Formatowanie kwot
    function formatAmount(amount) {
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: 'PLN',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Formatowanie dat
    function formatDate(dateString) {
        return new Intl.DateTimeFormat('pl-PL').format(new Date(dateString));
    }

    // Automatyczne ustawianie daty
    document.getElementById('issueDate').valueAsDate = new Date();
    document.getElementById('dueDate').valueAsDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Walidacja formularza przed generowaniem PDF
    invoiceForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const sellerNIP = document.getElementById("sellerNIP").value;
        const buyerNIP = document.getElementById("buyerNIP").value;
        
        if (!validateNIP(sellerNIP) || !validateNIP(buyerNIP)) {
            alert("Nieprawidłowy numer NIP!");
            return;
        }

        // Animacja podczas generowania PDF
        const generateBtn = document.getElementById("generatePdfButton");
        generateBtn.disabled = true;
        generateBtn.textContent = "Generowanie...";
        
        try {
            const options = {
                margin: 1,
                filename: `rachunek_${document.getElementById("invoiceNumber").value}.pdf`,
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            await html2pdf().set(options).from(invoicePreview).save();
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = "Generuj PDF";
        }
    });

    // Automatyczne zapisywanie w localStorage
    const saveToLocalStorage = () => {
        const formData = {
            sellerInfo: {
                name: document.getElementById("sellerName").value,
                address: document.getElementById("sellerAddress").value,
                nip: document.getElementById("sellerNIP").value
            },
            // ... pozostałe dane
        };
        localStorage.setItem('invoiceFormData', JSON.stringify(formData));
    };

    // Nasłuchiwanie zmian w formularzu
    invoiceForm.addEventListener('input', saveToLocalStorage);

    // Generowanie PDF
    invoiceForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const options = {
            margin: 1,
            filename: 'rachunek.pdf',
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(options).from(invoicePreview).save();
    });

    // Obsługa trybu ciemnego
    const themeSwitcher = document.getElementById('themeSwitcher');
    themeSwitcher.addEventListener('click', () => {
        document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        themeSwitcher.textContent = document.body.dataset.theme === 'dark' ? '☀️' : '🌙';
    });

    // Obsługa logo
    const uploadLogo = document.getElementById('uploadLogo');
    const logoInput = document.getElementById('logoInput');
    
    uploadLogo.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const logo = document.createElement('img');
                logo.src = e.target.result;
                logo.classList.add('company-logo');
                localStorage.setItem('companyLogo', e.target.result);
                updatePreview();
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
});

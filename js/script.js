document.addEventListener("DOMContentLoaded", () => {
    const invoiceForm = document.getElementById("invoiceForm");
    const itemsTableBody = document.getElementById("itemsTableBody");
    const addItemButton = document.getElementById("addItemButton");
    const generatePdfButton = document.getElementById("generatePdfButton");
    const invoicePreview = document.getElementById("invoicePreview");
    const saveTemplateButton = document.getElementById("saveTemplateButton");
    const loadTemplateButton = document.getElementById("loadTemplateButton");
    const templateModal = document.getElementById("templateModal");
    const templateName = document.getElementById("templateName");
    const templatesList = document.getElementById("templatesList");
    const confirmTemplateAction = document.getElementById("confirmTemplateAction");
    const cancelTemplateAction = document.getElementById("cancelTemplateAction");
    const modalTitle = document.getElementById("modalTitle");
    const closeButton = document.querySelector(".close-button");
    const currency = document.getElementById("currency");
    const toastContainer = document.getElementById("toastContainer");
    const printPreviewBtn = document.getElementById("printPreviewBtn");

    let currentAction = "save"; // Domyślna akcja dla modalu (save/load)

    // Dodawanie nowej pozycji
    addItemButton.addEventListener("click", () => {
        addNewInvoiceRow();
    });

    function addNewInvoiceRow() {
        const row = document.createElement("tr");
        row.classList.add("item-row");
        row.innerHTML = `
            <td><input type="text" class="item-description" placeholder="Opis" required></td>
            <td><input type="number" class="item-quantity" placeholder="Ilość" min="1" value="1" required></td>
            <td><input type="number" class="item-price" placeholder="Cena jedn." step="0.01" min="0" required></td>
            <td class="item-total">0.00</td>
            <td><button type="button" class="delete-item-btn"><i class="fas fa-trash"></i></button></td>
        `;
        itemsTableBody.appendChild(row);

        // Dodawanie animacji przy dodawaniu pozycji
        row.style.animation = 'fadeIn 0.3s ease-out';

        // Obsługa usuwania pozycji
        row.querySelector(".delete-item-btn").addEventListener("click", () => {
            row.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                row.remove();
                updatePreview();
            }, 300);
        });

        // Aktualizacja podglądu przy zmianie danych
        row.querySelectorAll("input").forEach(input => {
            input.addEventListener("input", updatePreview);
        });

        // Automatyczne przeliczanie sumy
        const quantityInput = row.querySelector(".item-quantity");
        const priceInput = row.querySelector(".item-price");
        
        [quantityInput, priceInput].forEach(input => {
            input.addEventListener("input", () => {
                const quantity = parseFloat(quantityInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                const total = quantity * price;
                row.querySelector(".item-total").textContent = formatAmount(total).replace(` ${getCurrencySymbol()}`, "");
                updatePreview();
            });
        });
    }

    // Funkcja do wyświetlania komunikatów
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // Aktualizacja podglądu rachunku
    function updatePreview() {
        let totalSum = 0;
        const items = Array.from(itemsTableBody.querySelectorAll(".item-row")).map(row => {
            const description = row.querySelector(".item-description").value;
            const quantity = parseFloat(row.querySelector(".item-quantity").value) || 0;
            const price = parseFloat(row.querySelector(".item-price").value) || 0;
            const total = quantity * price;
            totalSum += total;
            return { description, quantity, price, total };
        });

        const logo = localStorage.getItem('companyLogo');
        const logoHtml = logo ? `<img src="${logo}" class="company-logo" alt="Logo firmy">` : '';
        const currencySymbol = getCurrencySymbol();
        const sellerBankAccount = document.getElementById("sellerBankAccount").value;
        const sellerBankName = document.getElementById("sellerBankName").value;
        const paymentMethod = document.getElementById("paymentMethod").value;
        const placeOfIssue = document.getElementById("placeOfIssue").value;

        // Mapowanie opcji płatności na pełne nazwy
        const paymentMethods = {
            'przelew': 'Przelew bankowy',
            'gotowka': 'Gotówka',
            'karta': 'Karta płatnicza',
            'blik': 'BLIK'
        };

        // Generowanie podglądu HTML
        invoicePreview.innerHTML = `
            <div class="invoice-header">
                ${logoHtml ? `<div>${logoHtml}</div>` : '<div></div>'}
                <div></div>
                <div>
                    <table class="invoice-meta">
                        <tr>
                            <td class="head">Miejsce wystawienia</td>
                        </tr>
                        <tr>
                            <td class="body">${placeOfIssue || 'Wrocław'}</td>
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
                        <td colspan="5" align="right"><strong>Razem:</strong></td>
                        <td align="right"><strong>${formatAmount(totalSum)}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div class="payment-info">
                <table class="payment-details">
                    <tr>
                        <td>Sposób płatności:</td>
                        <td>${paymentMethods[paymentMethod] || 'przelew'}</td>
                    </tr>
                    <tr>
                        <td>Termin płatności:</td>
                        <td>${formatDate(document.getElementById("dueDate").value)}</td>
                    </tr>
                    ${sellerBankAccount ? `
                    <tr>
                        <td>Numer konta:</td>
                        <td>${sellerBankAccount}</td>
                    </tr>` : ''}
                    ${sellerBankName ? `
                    <tr>
                        <td>Bank:</td>
                        <td>${sellerBankName}</td>
                    </tr>` : ''}
                    <tr>
                        <td>Waluta:</td>
                        <td>${currency.value}</td>
                    </tr>
                </table>
            </div>

            <div class="signature-area">
                <div style="height: 60px;"></div>
                <div>Podpis osoby upoważnionej do wystawienia</div>
            </div>
        `;
    }

    // Pobieranie symbolu waluty
    function getCurrencySymbol() {
        const currencies = {
            'PLN': 'PLN',
            'EUR': 'EUR',
            'USD': 'USD',
            'GBP': 'GBP',
            'CHF': 'CHF'
        };
        return currencies[currency.value] || 'PLN';
    }

    // Walidacja NIP
    function validateNIP(nip) {
        // Uproszczona walidacja - można rozbudować
        nip = nip.replace(/[^0-9]/g, '');
        
        if (nip.length !== 10) return false;
        
        const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        let sum = 0;
        weights.forEach((weight, index) => {
            sum += weight * parseInt(nip[index]);
        });
        
        return (sum % 11) === parseInt(nip[9]);
    }

    // Formatowanie kwot z uwzględnieniem waluty
    function formatAmount(amount) {
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: currency.value,
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Formatowanie dat
    function formatDate(dateString) {
        return new Intl.DateTimeFormat('pl-PL').format(new Date(dateString));
    }

    // Zmiana waluty
    currency.addEventListener('change', updatePreview);

    // Automatyczne ustawianie daty
    document.getElementById('issueDate').valueAsDate = new Date();
    document.getElementById('dueDate').valueAsDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Dodanie pierwszej pozycji automatycznie przy ładowaniu
    addNewInvoiceRow();

    // Obsługa modalu
    function openModal(action) {
        currentAction = action;
        templateModal.style.display = 'flex';
        templateName.value = '';
        
        if (action === 'save') {
            modalTitle.textContent = 'Zapisz szablon';
            confirmTemplateAction.textContent = 'Zapisz';
            templatesList.style.display = 'none';
        } else {
            modalTitle.textContent = 'Wczytaj szablon';
            confirmTemplateAction.textContent = 'Wczytaj';
            loadTemplatesList();
            templatesList.style.display = 'block';
        }
    }

    function closeModal() {
        templateModal.style.display = 'none';
    }

    function loadTemplatesList() {
        templatesList.innerHTML = '';
        const templates = getTemplates();
        
        if (templates.length === 0) {
            templatesList.innerHTML = '<p>Brak zapisanych szablonów</p>';
            return;
        }
        
        templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-item';
            item.innerHTML = `
                <span>${template.name}</span>
                <div class="template-actions">
                    <button class="load-template" data-id="${template.id}"><i class="fas fa-check"></i></button>
                    <button class="delete-template" data-id="${template.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            templatesList.appendChild(item);
        });
        
        // Event listenery dla przycisków
        document.querySelectorAll('.load-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                loadTemplate(id);
                closeModal();
            });
        });
        
        document.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                deleteTemplate(id);
                loadTemplatesList(); // Odświeżenie listy
            });
        });
    }

    // Funkcje do operacji na szablonach
    function getTemplates() {
        const templates = localStorage.getItem('invoiceTemplates');
        return templates ? JSON.parse(templates) : [];
    }
    
    function saveTemplate() {
        const name = templateName.value.trim();
        if (!name) {
            showToast('Podaj nazwę szablonu', 'error');
            return;
        }
        
        const formData = {
            id: Date.now().toString(),
            name: name,
            sellerInfo: {
                name: document.getElementById("sellerName").value,
                address: document.getElementById("sellerAddress").value,
                nip: document.getElementById("sellerNIP").value,
                bankAccount: document.getElementById("sellerBankAccount").value,
                bankName: document.getElementById("sellerBankName").value
            },
            buyerInfo: {
                name: document.getElementById("buyerName").value,
                address: document.getElementById("buyerAddress").value,
                nip: document.getElementById("buyerNIP").value
            },
            invoiceDetails: {
                number: document.getElementById("invoiceNumber").value,
                currency: currency.value,
                paymentMethod: document.getElementById("paymentMethod").value,
                placeOfIssue: document.getElementById("placeOfIssue").value
            }
        };
        
        const templates = getTemplates();
        templates.push(formData);
        localStorage.setItem('invoiceTemplates', JSON.stringify(templates));
        
        showToast(`Szablon "${name}" został zapisany`);
        closeModal();
    }
    
    function loadTemplate(id) {
        const templates = getTemplates();
        const template = templates.find(t => t.id === id);
        
        if (!template) {
            showToast('Nie znaleziono szablonu', 'error');
            return;
        }
        
        // Wypełnienie formularza danymi z szablonu
        document.getElementById("sellerName").value = template.sellerInfo.name || '';
        document.getElementById("sellerAddress").value = template.sellerInfo.address || '';
        document.getElementById("sellerNIP").value = template.sellerInfo.nip || '';
        document.getElementById("sellerBankAccount").value = template.sellerInfo.bankAccount || '';
        document.getElementById("sellerBankName").value = template.sellerInfo.bankName || '';
        
        document.getElementById("buyerName").value = template.buyerInfo.name || '';
        document.getElementById("buyerAddress").value = template.buyerInfo.address || '';
        document.getElementById("buyerNIP").value = template.buyerInfo.nip || '';
        
        if (template.invoiceDetails) {
            document.getElementById("invoiceNumber").value = template.invoiceDetails.number || '';
            currency.value = template.invoiceDetails.currency || 'PLN';
            document.getElementById("paymentMethod").value = template.invoiceDetails.paymentMethod || 'przelew';
            document.getElementById("placeOfIssue").value = template.invoiceDetails.placeOfIssue || 'Wrocław';
        }
        
        showToast(`Szablon "${template.name}" został wczytany`);
        updatePreview();
    }
    
    function deleteTemplate(id) {
        const templates = getTemplates();
        const index = templates.findIndex(t => t.id === id);
        
        if (index !== -1) {
            const deletedName = templates[index].name;
            templates.splice(index, 1);
            localStorage.setItem('invoiceTemplates', JSON.stringify(templates));
            showToast(`Szablon "${deletedName}" został usunięty`);
        }
    }

    // Event listenery dla modalu
    saveTemplateButton.addEventListener('click', () => openModal('save'));
    loadTemplateButton.addEventListener('click', () => openModal('load'));
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === templateModal) closeModal();
    });
    
    confirmTemplateAction.addEventListener('click', () => {
        if (currentAction === 'save') {
            saveTemplate();
        } else {
            // W przypadku 'load' używamy przycisków przy szablonach
        }
    });
    
    cancelTemplateAction.addEventListener('click', closeModal);

    // Walidacja formularza przed generowaniem PDF
    invoiceForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const sellerNIP = document.getElementById("sellerNIP").value;
        const buyerNIP = document.getElementById("buyerNIP").value;
        
        // Sprawdź czy są pozycje na fakturze
        if (itemsTableBody.querySelectorAll(".item-row").length === 0) {
            showToast("Dodaj przynajmniej jedną pozycję do rachunku!", 'error');
            return;
        }

        // Walidacja NIP (opcjonalna - można usunąć, jeśli nie jest potrzebna)
        if (!validateNIP(sellerNIP) || !validateNIP(buyerNIP)) {
            showToast("Nieprawidłowy numer NIP! Upewnij się, że podany NIP jest poprawny.", 'error');
            return;
        }

        // Animacja podczas generowania PDF
        const generateBtn = document.getElementById("generatePdfButton");
        const originalText = generateBtn.innerHTML;
        generateBtn.disabled = true;
        generateBtn.innerHTML = `<span class="spinner"></span> Generowanie...`;
        
        try {
            const options = {
                margin: 10,
                filename: `rachunek_${document.getElementById("invoiceNumber").value}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            await html2pdf().set(options).from(invoicePreview).save();
            showToast("PDF został pomyślnie wygenerowany");
        } catch (error) {
            showToast("Wystąpił błąd podczas generowania PDF", 'error');
            console.error("Błąd generowania PDF:", error);
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalText;
        }
    });

    // Drukowanie podglądu
    printPreviewBtn.addEventListener("click", () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Drukuj rachunek</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .invoice-preview { padding: 20mm; margin: 0 auto; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 0.5px solid black; padding: 8px; }
                    @media print {
                        body { margin: 0; }
                        .invoice-preview { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-preview">
                    ${invoicePreview.innerHTML}
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `);
    });

    // Obsługa logo
    const uploadLogo = document.getElementById('uploadLogo');
    const logoInput = document.getElementById('logoInput');
    
    uploadLogo.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                localStorage.setItem('companyLogo', e.target.result);
                showToast("Logo zostało dodane");
                updatePreview();
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Inicjalizacja podglądu formularza
    updatePreview();

    // Automatyczne zapisywanie w localStorage
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    const saveToLocalStorage = debounce(() => {
        const formData = {
            sellerInfo: {
                name: document.getElementById("sellerName").value,
                address: document.getElementById("sellerAddress").value,
                nip: document.getElementById("sellerNIP").value,
                bankAccount: document.getElementById("sellerBankAccount").value,
                bankName: document.getElementById("sellerBankName").value
            },
            buyerInfo: {
                name: document.getElementById("buyerName").value,
                address: document.getElementById("buyerAddress").value,
                nip: document.getElementById("buyerNIP").value
            },
            invoiceDetails: {
                number: document.getElementById("invoiceNumber").value,
                currency: currency.value,
                paymentMethod: document.getElementById("paymentMethod").value,
                placeOfIssue: document.getElementById("placeOfIssue").value
            },
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('invoiceFormData', JSON.stringify(formData));
    }, 500);

    const loadFromLocalStorage = () => {
        const savedData = localStorage.getItem('invoiceFormData');
        if (savedData) {
            try {
                const formData = JSON.parse(savedData);
                
                if (formData.sellerInfo) {
                    document.getElementById("sellerName").value = formData.sellerInfo.name || '';
                    document.getElementById("sellerAddress").value = formData.sellerInfo.address || '';
                    document.getElementById("sellerNIP").value = formData.sellerInfo.nip || '';
                    document.getElementById("sellerBankAccount").value = formData.sellerInfo.bankAccount || '';
                    document.getElementById("sellerBankName").value = formData.sellerInfo.bankName || '';
                }
                
                if (formData.buyerInfo) {
                    document.getElementById("buyerName").value = formData.buyerInfo.name || '';
                    document.getElementById("buyerAddress").value = formData.buyerInfo.address || '';
                    document.getElementById("buyerNIP").value = formData.buyerInfo.nip || '';
                }
                
                if (formData.invoiceDetails) {
                    document.getElementById("invoiceNumber").value = formData.invoiceDetails.number || '';
                    currency.value = formData.invoiceDetails.currency || 'PLN';
                    document.getElementById("paymentMethod").value = formData.invoiceDetails.paymentMethod || 'przelew';
                    document.getElementById("placeOfIssue").value = formData.invoiceDetails.placeOfIssue || 'Wrocław';
                }
                
                updatePreview();
            } catch (e) {
                console.error("Błąd podczas wczytywania danych z localStorage:", e);
            }
        }
    };
    
    invoiceForm.addEventListener('input', () => {
        saveToLocalStorage();
        updatePreview();
    });
    
    loadFromLocalStorage();

    const themeSwitcher = document.getElementById('themeSwitcher');
    themeSwitcher.addEventListener('click', () => {
        if (document.body.dataset.theme === 'dark') {
            document.body.dataset.theme = 'light';
            themeSwitcher.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        } else {
            document.body.dataset.theme = 'dark';
            themeSwitcher.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        }
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.dataset.theme = 'dark';
        themeSwitcher.textContent = '☀️';
    }
});

document.head.insertAdjacentHTML('beforeend', `
    <style>
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
    .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        align-items: center;
        justify-content: center;
    }
    
    .modal-content {
        background-color: var(--form-bg);
        color: var(--text-color);
        padding: 2rem;
        border-radius: 8px;
        width: 95%;
        max-width: 500px;
        box-shadow: var(--shadow);
        position: relative;
    }
    
    .close-button {
        position: absolute;
        top: 15px;
        right: 20px;
        font-size: 1.5rem;
        cursor: pointer;
    }
    
    .templates-list {
        max-height: 300px;
        overflow-y: auto;
        margin: 1rem 0;
    }
    
    .template-item {
        padding: 0.75rem;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        margin-bottom: 0.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .template-actions button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 5px 8px;
        border-radius: 4px;
    }
    
    .load-template {
        color: var(--success-color);
    }
    
    .delete-template {
        color: var(--error-color);
    }
    
    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1.5rem;
    }
    
    .modal-actions button {
        padding: 0.6rem 1.2rem;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        border: none;
    }
    
    .primary-button {
        background-color: var(--primary-color);
        color: white;
    }
    
    .secondary-button {
        background-color: #6b7280;
        color: white;
    }
    </style>
`);

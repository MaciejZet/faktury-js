document.addEventListener("DOMContentLoaded", () => {
    const invoiceForm = document.getElementById("invoiceForm");
    const itemsTableBody = document.getElementById("itemsTableBody");
    const addItemButton = document.getElementById("addItemButton");
    const generatePdfButton = document.getElementById("generatePdfButton");
    const invoicePreview = document.getElementById("invoicePreview");
    const saveTemplateButton = document.getElementById("saveTemplateButton");
    const loadTemplateButton = document.getElementById("loadTemplateButton");
    const templateModal = document.getElementById("templateModal");
    const templateNameInput = document.getElementById("templateName");
    const templatesList = document.getElementById("templatesList");
    const confirmTemplateAction = document.getElementById("confirmTemplateAction");
    const cancelTemplateAction = document.getElementById("cancelTemplateAction");
    const modalTitle = document.getElementById("modalTitle");
    const closeButton = document.querySelector(".close-button");
    const currency = document.getElementById("currency");
    const toastContainer = document.getElementById("toastContainer");
    const printPreviewBtn = document.getElementById("printPreviewBtn");

    const contactModal = document.getElementById("contactModal");
    const contactModalTitle = document.getElementById("contactModalTitle");
    const contactNameInput = document.getElementById("contactName");
    const contactsListContainer = document.getElementById("contactsListContainer");
    const contactsList = document.getElementById("contactsList");
    const confirmContactAction = document.getElementById("confirmContactAction");
    const cancelContactAction = document.getElementById("cancelContactAction");
    const contactModalCloseButton = document.querySelector(".contact-modal-close-button");

    const saveSellerButton = document.getElementById('saveSellerButton');
    const loadSellerButton = document.getElementById('loadSellerButton');
    const saveBuyerButton = document.getElementById('saveBuyerButton');
    const loadBuyerButton = document.getElementById('loadBuyerButton');

    let currentAction = "save";
    let currentContactAction = "save";
    let currentContactType = "seller";

    // Add new variables
    const sellerHasNIP = document.getElementById('sellerHasNIP');
    const buyerHasNIP = document.getElementById('buyerHasNIP');
    const isVATExempt = document.getElementById('isVATExempt');
    const amountInWordsGroup = document.getElementById('amountInWordsGroup');
    const amountInWords = document.getElementById('amountInWords');

    const defaultUnitSelect = document.getElementById('defaultUnit');
    
    // Add event listener for default unit change
    defaultUnitSelect.addEventListener('change', function() {
        updatePreview();
    });

    addItemButton.addEventListener("click", () => {
        addItem();
    });

    function addItem() {
        const tbody = document.getElementById('itemsTableBody');
        const row = document.createElement('tr');
        row.className = 'item-row';
        
        const defaultUnit = defaultUnitSelect.value;
        
        row.innerHTML = `
            <td><input type="text" class="item-description" required></td>
            <td><input type="number" class="item-quantity" value="1" min="0.01" step="0.01" required> ${defaultUnit}</td>
            <td><input type="number" class="item-price" value="0.00" min="0" step="0.01" required></td>
            <td><input type="number" class="item-total" value="0.00" readonly></td>
            <td><button type="button" class="delete-item-btn"><i class="fas fa-trash"></i></button></td>
        `;
        
        tbody.appendChild(row);
        updatePreview();
    }

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

    function updatePreview() {
        const preview = document.getElementById('invoicePreview');
        const items = Array.from(document.querySelectorAll('.item-row')).map(row => ({
            description: row.querySelector('.item-description').value,
            quantity: row.querySelector('.item-quantity').value,
            price: row.querySelector('.item-price').value,
            total: row.querySelector('.item-total').value
        }));

        let totalSum = 0;
        items.forEach(item => {
            totalSum += parseFloat(item.total) || 0;
        });

        const currencySymbol = document.getElementById('currency').value;
        const isVATExempt = document.getElementById('isVATExempt').checked;
        const defaultUnit = defaultUnitSelect.value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const bankAccount = document.getElementById('sellerBankAccount').value;
        const bankName = document.getElementById('sellerBankName').value;

        preview.innerHTML = `
            <div class="invoice-header">
                <div class="company-logo">
                    <img id="previewLogo" src="" alt="Logo" style="display: none;">
                </div>
                <div class="invoice-title">
                    ${document.getElementById('isVATExempt').checked ? 'Faktura' : 'Faktura VAT'} ${document.getElementById('invoiceNumber').value}
                </div>
                <div class="invoice-meta">
                    <div class="head">Data wystawienia:</div>
                    <div class="body">${document.getElementById('issueDate').value}</div>
                    <div class="head">Miejsce wystawienia:</div>
                    <div class="body">${document.getElementById('placeOfIssue').value}</div>
                </div>
            </div>

            <div class="parties-grid">
                <div class="invoice-party">
                    <div class="party-header">${document.getElementById('sellerType').value.charAt(0).toUpperCase() + document.getElementById('sellerType').value.slice(1)}</div>
                    <div class="party-details">
                        ${document.getElementById('sellerName').value}<br>
                        ${document.getElementById('sellerAddress').value}<br>
                        ${document.getElementById('sellerHasNIP').checked ? `NIP: ${document.getElementById('sellerNIP').value}` : ''}<br>
                        ${document.getElementById('sellerBankAccount').value ? `Nr konta: ${document.getElementById('sellerBankAccount').value}` : ''}<br>
                        ${document.getElementById('sellerBankName').value ? `Bank: ${document.getElementById('sellerBankName').value}` : ''}
                    </div>
                </div>
                <div class="invoice-party">
                    <div class="party-header">${document.getElementById('buyerType').value.charAt(0).toUpperCase() + document.getElementById('buyerType').value.slice(1)}</div>
                    <div class="party-details">
                        ${document.getElementById('buyerName').value}<br>
                        ${document.getElementById('buyerAddress').value}<br>
                        ${document.getElementById('buyerHasNIP').checked ? `NIP: ${document.getElementById('buyerNIP').value}` : ''}
                    </div>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th width="5%">Lp.</th>
                        <th>Nazwa towaru/usługi</th>
                        <th width="12%">Ilość [${defaultUnit}]</th>
                        <th width="12%">Cena</th>
                        <th width="12%">Wartość</th>
                        ${!isVATExempt ? '<th width="8%">Stawka VAT</th><th width="12%">Kwota VAT</th><th width="12%">Wartość brutto</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => {
                        const quantity = parseFloat(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        const total = quantity * price;
                        const vatRate = isVATExempt ? 0 : 23;
                        const vatAmount = isVATExempt ? 0 : total * (vatRate / 100);
                        const totalWithVat = total + vatAmount;
                        
                        return `
                            <tr>
                                <td align="center">${index + 1}</td>
                                <td>${item.description}</td>
                                <td align="center">${quantity.toFixed(0)}</td>
                                <td align="right">${price.toFixed(2)} ${currencySymbol}</td>
                                <td align="right">${total.toFixed(2)} ${currencySymbol}</td>
                                ${!isVATExempt ? `
                                    <td align="center">${vatRate}%</td>
                                    <td align="right">${vatAmount.toFixed(2)} ${currencySymbol}</td>
                                    <td align="right">${totalWithVat.toFixed(2)} ${currencySymbol}</td>
                                ` : ''}
                            </tr>
                        `;
                    }).join('')}
                    <tr>
                        <td colspan="${isVATExempt ? '4' : '7'}" align="right"><strong>Razem:</strong></td>
                        <td align="right"><strong>${totalSum.toFixed(2)} ${currencySymbol}</strong></td>
                    </tr>
                </tbody>
            </table>

            ${isVATExempt ? `
                <div class="vat-exemption">
                    Przepis na podstawie którego stosowane jest zwolnienie od podatku (stawka VAT zw.): Zwolnienie ze względu na nieprzekroczenie
200 000 PLN obrotu (art. 113 ust 1 i 9 ustawy o VAT).
                </div>
            ` : ''}

            <div class="payment-info">
                <table class="payment-details">
                    <tr>
                        <td>Termin płatności:</td>
                        <td>${document.getElementById('dueDate').value}</td>
                    </tr>
                    <tr>
                        <td>Sposób płatności:</td>
                        <td>${paymentMethod}</td>
                    </tr>
                    ${paymentMethod === 'przelew' && bankAccount ? `
                    <tr>
                        <td>Numer rachunku:</td>
                        <td>${bankAccount}${bankName ? ` (${bankName})` : ''}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
        `;
    }

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

    function validateNIP(nip) {
        nip = nip.replace(/[^0-9]/g, '');
        
        if (nip.length !== 10) return false;
        
        const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        let sum = 0;
        weights.forEach((weight, index) => {
            sum += weight * parseInt(nip[index]);
        });
        
        return (sum % 11) === parseInt(nip[9]);
    }

    function formatAmount(amount) {
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: currency.value,
            minimumFractionDigits: 2
        }).format(amount);
    }

    function formatDate(dateString) {
        return new Intl.DateTimeFormat('pl-PL').format(new Date(dateString));
    }

    currency.addEventListener('change', updatePreview);

    document.getElementById('issueDate').valueAsDate = new Date();
    document.getElementById('dueDate').valueAsDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    addItem();

    function openModal(action) {
        currentAction = action;
        templateModal.style.display = "flex";
        if (action === 'save') {
            modalTitle.textContent = "Zapisz szablon";
            confirmTemplateAction.textContent = "Zapisz";
            templateNameInput.style.display = 'block';
            templatesList.style.display = 'none';
        } else {
            modalTitle.textContent = "Wczytaj szablon";
            confirmTemplateAction.textContent = "Wczytaj";
            templateNameInput.style.display = 'none';
            templatesList.style.display = 'block';
            loadTemplatesList();
        }
    }

    function closeModal() {
        templateModal.style.display = "none";
    }

    saveTemplateButton.addEventListener('click', () => openModal('save'));
    loadTemplateButton.addEventListener('click', () => openModal('load'));
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === templateModal) {
            closeModal();
        }
        if (e.target === contactModal) {
            closeContactModal();
        }
    });
    
    confirmTemplateAction.addEventListener('click', () => {
        if (currentAction === 'save') {
            saveTemplate();
        } 
        closeModal();
    });
    
    cancelTemplateAction.addEventListener('click', closeModal);

    function openContactModal(action, type) {
        currentContactAction = action;
        currentContactType = type;
        contactModal.style.display = "flex";
        contactsListContainer.style.display = 'none';
        contactNameInput.parentElement.style.display = 'block';

        if (action === 'save') {
            contactModalTitle.textContent = type === 'seller' ? "Zapisz dane sprzedawcy" : "Zapisz dane nabywcy";
            confirmContactAction.textContent = "Zapisz";
            contactNameInput.value = '';
        } else {
            contactModalTitle.textContent = type === 'seller' ? "Wczytaj dane sprzedawcy" : "Wczytaj dane nabywcy";
            confirmContactAction.textContent = "Wczytaj";
            contactNameInput.parentElement.style.display = 'none';
            contactsListContainer.style.display = 'block';
            loadContactsList(type);
        }
    }

    function closeContactModal() {
        contactModal.style.display = "none";
    }

    function getContacts(type) {
        return JSON.parse(localStorage.getItem(type === 'seller' ? 'sellerContacts' : 'buyerContacts')) || [];
    }

    function saveContact() {
        const contactName = contactNameInput.value.trim();
        if (!contactName) {
            showToast("Nazwa wpisu nie może być pusta.", 'error');
            return;
        }

        const contacts = getContacts(currentContactType);
        if (contacts.some(c => c.name === contactName)) {
            if (!confirm(`Kontakt o nazwie "${contactName}" już istnieje. Czy chcesz go nadpisać?`)) {
                return;
            }
        }

        let contactData = {};
        if (currentContactType === 'seller') {
            contactData = {
                name: contactName,
                sellerType: document.getElementById('sellerType').value,
                sellerName: document.getElementById('sellerName').value,
                sellerAddress: document.getElementById('sellerAddress').value,
                sellerNIP: document.getElementById('sellerNIP').value,
                sellerBankAccount: document.getElementById('sellerBankAccount').value,
                sellerBankName: document.getElementById('sellerBankName').value,
            };
        } else {
            contactData = {
                name: contactName,
                buyerType: document.getElementById('buyerType').value,
                buyerName: document.getElementById('buyerName').value,
                buyerAddress: document.getElementById('buyerAddress').value,
                buyerNIP: document.getElementById('buyerNIP').value,
            };
        }

        const newContacts = contacts.filter(c => c.name !== contactName);
        newContacts.push(contactData);
        localStorage.setItem(currentContactType === 'seller' ? 'sellerContacts' : 'buyerContacts', JSON.stringify(newContacts));
        showToast("Dane zapisano pomyślnie.");
        closeContactModal();
    }

    function loadContact(name, type) {
        const contacts = getContacts(type);
        const contact = contacts.find(c => c.name === name);
        if (contact) {
            if (type === 'seller') {
                if (contact.sellerType) {
                    document.getElementById('sellerType').value = contact.sellerType;
                }
                document.getElementById('sellerName').value = contact.sellerName || '';
                document.getElementById('sellerAddress').value = contact.sellerAddress || '';
                document.getElementById('sellerNIP').value = contact.sellerNIP || '';
                document.getElementById('sellerBankAccount').value = contact.sellerBankAccount || '';
                document.getElementById('sellerBankName').value = contact.sellerBankName || '';
            } else {
                if (contact.buyerType) {
                    document.getElementById('buyerType').value = contact.buyerType;
                }
                document.getElementById('buyerName').value = contact.buyerName || '';
                document.getElementById('buyerAddress').value = contact.buyerAddress || '';
                document.getElementById('buyerNIP').value = contact.buyerNIP || '';
            }
            showToast(`Dane dla "${name}" wczytano.`);
            updatePreview();
        } else {
            showToast(`Nie znaleziono danych dla "${name}".`, 'error');
        }
        closeContactModal();
    }

    function deleteContact(name, type) {
        if (!confirm(`Czy na pewno chcesz usunąć kontakt "${name}"?`)) return;
        let contacts = getContacts(type);
        contacts = contacts.filter(c => c.name !== name);
        localStorage.setItem(type === 'seller' ? 'sellerContacts' : 'buyerContacts', JSON.stringify(contacts));
        showToast(`Kontakt "${name}" usunięto.`);
        loadContactsList(type);
    }

    function loadContactsList(type) {
        contactsList.innerHTML = '';
        const contacts = getContacts(type);
        if (contacts.length === 0) {
            contactsList.innerHTML = '<p>Brak zapisanych kontaktów.</p>';
            return;
        }
        contacts.forEach(contact => {
            const item = document.createElement('div');
            item.classList.add('template-item');
            item.innerHTML = `
                <span>${contact.name}</span>
                <div class="template-actions">
                    <button class="load-contact" data-name="${contact.name}" data-type="${type}"><i class="fas fa-download"></i> Wczytaj</button>
                    <button class="delete-contact" data-name="${contact.name}" data-type="${type}"><i class="fas fa-trash"></i> Usuń</button>
                </div>
            `;
            contactsList.appendChild(item);
        });

        contactsList.querySelectorAll('.load-contact').forEach(button => {
            button.addEventListener('click', (e) => {
                const name = e.target.closest('button').dataset.name;
                const contactType = e.target.closest('button').dataset.type;
                loadContact(name, contactType);
            });
        });
        contactsList.querySelectorAll('.delete-contact').forEach(button => {
            button.addEventListener('click', (e) => {
                const name = e.target.closest('button').dataset.name;
                const contactType = e.target.closest('button').dataset.type;
                deleteContact(name, contactType);
            });
        });
    }

    saveSellerButton.addEventListener('click', () => openContactModal('save', 'seller'));
    loadSellerButton.addEventListener('click', () => openContactModal('load', 'seller'));
    saveBuyerButton.addEventListener('click', () => openContactModal('save', 'buyer'));
    loadBuyerButton.addEventListener('click', () => openContactModal('load', 'buyer'));

    confirmContactAction.addEventListener('click', () => {
        if (currentContactAction === 'save') {
            saveContact();
        }
    });

    cancelContactAction.addEventListener('click', closeContactModal);
    contactModalCloseButton.addEventListener('click', closeContactModal);

    invoiceForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const sellerNIP = document.getElementById("sellerNIP").value;
        const buyerNIP = document.getElementById("buyerNIP").value;
        
        if (itemsTableBody.querySelectorAll(".item-row").length === 0) {
            showToast("Dodaj przynajmniej jedną pozycję do rachunku!", 'error');
            return;
        }

        if (sellerHasNIP.checked && !validateNIP(sellerNIP)) {
            showToast("Nieprawidłowy numer NIP sprzedawcy!", 'error');
            return;
        }

        if (buyerHasNIP.checked && !validateNIP(buyerNIP)) {
            showToast("Nieprawidłowy numer NIP nabywcy!", 'error');
            return;
        }

        const generateBtn = document.getElementById("generatePdfButton");
        const originalText = generateBtn.innerHTML;
        generateBtn.disabled = true;
        generateBtn.innerHTML = `<span class="spinner"></span> Generowanie...`;
        
        try {
            // Create a clone of the invoice preview
            const element = invoicePreview.cloneNode(true);
            
            // Convert all images to data URLs
            const images = element.getElementsByTagName('img');
            for (const img of images) {
                if (img.src) {
                    try {
                        const response = await fetch(img.src);
                        const blob = await response.blob();
                        const dataUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        img.src = dataUrl;
                    } catch (err) {
                        console.warn('Image could not be converted:', err);
                        img.remove();
                    }
                }
            }

            // Set dimensions and styles
            element.style.width = '210mm';
            element.style.height = '297mm';
            element.style.padding = '20mm';
            element.style.margin = '0';
            element.style.backgroundColor = '#ffffff';
            element.style.position = 'absolute';
            element.style.left = '-9999px';
            document.body.appendChild(element);

            const opt = {
                margin: 0,
                filename: `rachunek_${document.getElementById("invoiceNumber").value}.pdf`,
                image: { type: 'jpeg', quality: 1 },
                html2canvas: { 
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: true,
                    windowWidth: 794, // A4 width in pixels at 96 DPI
                    windowHeight: 1123, // A4 height in pixels at 96 DPI
                    onclone: function(clonedDoc) {
                        const clonedElement = clonedDoc.getElementById('invoicePreview');
                        if (clonedElement) {
                            clonedElement.style.width = '210mm';
                            clonedElement.style.height = '297mm';
                            clonedElement.style.padding = '20mm';
                            clonedElement.style.margin = '0';
                            clonedElement.style.backgroundColor = '#ffffff';
                            clonedElement.style.position = 'relative';
                            clonedElement.style.left = '0';
                            clonedElement.style.top = '0';
                        }
                    }
                },
                jsPDF: { 
                    unit: 'mm', 
                    format: 'a4', 
                    orientation: 'portrait',
                    compress: true
                }
            };

            await html2pdf().set(opt).from(element).save();
            document.body.removeChild(element);
            showToast("PDF został pomyślnie wygenerowany");
        } catch (error) {
            console.error("Błąd generowania PDF:", error);
            showToast("Wystąpił błąd podczas generowania PDF", 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalText;
        }
    });

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

    updatePreview();

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
                type: document.getElementById("sellerType").value,
                name: document.getElementById("sellerName").value,
                address: document.getElementById("sellerAddress").value,
                nip: document.getElementById("sellerNIP").value,
                bankAccount: document.getElementById("sellerBankAccount").value,
                bankName: document.getElementById("sellerBankName").value
            },
            buyerInfo: {
                type: document.getElementById("buyerType").value,
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
                    if (formData.sellerInfo.type) {
                        document.getElementById("sellerType").value = formData.sellerInfo.type;
                    }
                    document.getElementById("sellerName").value = formData.sellerInfo.name || '';
                    document.getElementById("sellerAddress").value = formData.sellerInfo.address || '';
                    document.getElementById("sellerNIP").value = formData.sellerInfo.nip || '';
                    document.getElementById("sellerBankAccount").value = formData.sellerInfo.bankAccount || '';
                    document.getElementById("sellerBankName").value = formData.sellerInfo.bankName || '';
                }
                
                if (formData.buyerInfo) {
                    if (formData.buyerInfo.type) {
                        document.getElementById("buyerType").value = formData.buyerInfo.type;
                    }
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

    // Handle NIP visibility
    sellerHasNIP.addEventListener('change', () => {
        const sellerNIP = document.getElementById('sellerNIP');
        sellerNIP.required = sellerHasNIP.checked;
        sellerNIP.disabled = !sellerHasNIP.checked;
        if (!sellerHasNIP.checked) sellerNIP.value = '';
    });

    buyerHasNIP.addEventListener('change', () => {
        const buyerNIP = document.getElementById('buyerNIP');
        buyerNIP.required = buyerHasNIP.checked;
        buyerNIP.disabled = !buyerHasNIP.checked;
        if (!buyerHasNIP.checked) buyerNIP.value = '';
    });

    // Handle VAT exemption
    isVATExempt.addEventListener('change', () => {
        updatePreview();
    });

    // Function to convert number to words in Polish
    function numberToWords(number) {
        const units = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
        const teens = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
        const tens = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
        const hundreds = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
        const thousandForms = ['', 'tysiąc', 'tysiące', 'tysięcy'];
        const millionForms = ['', 'milion', 'miliony', 'milionów'];

        function convertGroup(n, group) {
            if (n === 0) return '';
            let result = '';
            
            if (n >= 100) {
                result += hundreds[Math.floor(n / 100)] + ' ';
                n %= 100;
            }
            
            if (n >= 20) {
                result += tens[Math.floor(n / 10)] + ' ';
                n %= 10;
            } else if (n >= 10) {
                result += teens[n - 10] + ' ';
                return result;
            }
            
            if (n > 0) {
                result += units[n] + ' ';
            }
            
            return result;
        }

        let result = '';
        const millionsCount = Math.floor(number / 1000000);
        const thousandsCount = Math.floor((number % 1000000) / 1000);
        const remainder = number % 1000;

        if (millionsCount > 0) {
            result += convertGroup(millionsCount, millionsCount) + 'milionów ';
        }
        
        if (thousandsCount > 0) {
            result += convertGroup(thousandsCount, thousandsCount) + 'tysięcy ';
        }
        
        if (remainder > 0) {
            result += convertGroup(remainder, remainder);
        }

        return result.trim();
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

// Глобальні змінні
let items = [];
let currentItem = null;
let fileMetadata = {
    name: '',
    date: '',
    totalItems: 0
};
let db = null;

// Статуси товарів
const STATUS = {
    MATCH: 'Відповідність',
    SHORTAGE: 'Нестача',
    EXCESS: 'Надлишок',
    UNCHECKED: 'Не перевірено'
};

// Кольори для статусів
const STATUS_COLORS = {
    [STATUS.MATCH]: '#34a853',
    [STATUS.SHORTAGE]: '#ea4335',
    [STATUS.EXCESS]: '#fbbc05',
    [STATUS.UNCHECKED]: '#9e9e9e'
};

// Ініціалізація додатку
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // Ініціалізація IndexedDB
    initializeDB().then(() => {
        // Завантаження даних з IndexedDB
        return Promise.all([
            getAllItemsFromDB(),
            getMetadataFromDB()
        ]);
    }).then(([savedItems, metadata]) => {
        if (savedItems && savedItems.length > 0) {
            items = savedItems;
            if (metadata) {
                fileMetadata = metadata;
                updateFileInfo();
            }
            updateUI();
        }
    }).catch(error => {
        showToast('Помилка при завантаженні даних: ' + error.message);
        console.error('Помилка при завантаженні даних:', error);
    });

    // Прив'язка обробників подій
    bindEventListeners();
    
    // Встановлення початкового фокусу
    document.getElementById('sku-input').focus();
}

function initializeDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('inventoryDB', 1);
        
        request.onerror = (event) => {
            console.error('Помилка при відкритті IndexedDB:', event.target.error);
            reject(new Error('Не вдалося відкрити базу даних'));
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Створення сховища для товарів
            const itemsStore = db.createObjectStore('items', { keyPath: 'sku' });
            itemsStore.createIndex('status', 'status', { unique: false });
            
            // Створення сховища для метаданих
            db.createObjectStore('metadata', { keyPath: 'id' });
        };
    });
}

function getAllItemsFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База даних не ініціалізована'));
            return;
        }
        
        const transaction = db.transaction(['items'], 'readonly');
        const store = transaction.objectStore('items');
        const request = store.getAll();
        
        request.onsuccess = () => {
            resolve(request.result || []);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function saveItemToDB(item) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База даних не ініціалізована'));
            return;
        }
        
        const transaction = db.transaction(['items'], 'readwrite');
        const store = transaction.objectStore('items');
        const request = store.put(item);
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function saveAllItemsToDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База даних не ініціалізована'));
            return;
        }
        
        const transaction = db.transaction(['items'], 'readwrite');
        const store = transaction.objectStore('items');
        
        // Очистити сховище перед збереженням нових даних
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
            // Додати всі товари
            const requests = items.map(item => store.put(item));
            
            Promise.all(requests).then(() => {
                resolve();
            }).catch(error => {
                reject(error);
            });
        };
        
        clearRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function clearItemsDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База даних не ініціалізована'));
            return;
        }
        
        const transaction = db.transaction(['items'], 'readwrite');
        const store = transaction.objectStore('items');
        const request = store.clear();
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function getMetadataFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База даних не ініціалізована'));
            return;
        }
        
        const transaction = db.transaction(['metadata'], 'readonly');
        const store = transaction.objectStore('metadata');
        const request = store.get(1);
        
        request.onsuccess = () => {
            resolve(request.result ? request.result.data : null);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function saveMetadataToDB(metadata) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База даних не ініціалізована'));
            return;
        }
        
        const transaction = db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        const request = store.put({ id: 1, data: metadata });
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function clearMetadataDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База даних не ініціалізована'));
            return;
        }
        
        const transaction = db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        const request = store.clear();
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function bindEventListeners() {
    // Обробники вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', switchTab);
    });
    
    // Обробники введення SKU
    document.getElementById('sku-input').addEventListener('input', function() {
        this.value = this.value.replace(/[^\d]/g, '');
    });
    
    document.getElementById('sku-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSkuInput();
        }
    });
    
    document.getElementById('sku-submit').addEventListener('click', handleSkuInput);
	
	document.getElementById('quantity-submit').addEventListener('click', handleQuantityInput);
    
    document.getElementById('quantity-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleQuantityInput();
        }
    });
    
    document.getElementById('quantity-submit').addEventListener('click', handleQuantityInput);
    
    // Обробники кнопок управління
    document.getElementById('open-file').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    document.getElementById('save-results').addEventListener('click', saveResultsToFile);
    
    document.getElementById('clear-data').addEventListener('click', confirmClearData);
    
    // Обробники фільтрації та пошуку
    document.getElementById('status-filter').addEventListener('change', updateUI);
    document.getElementById('search-input').addEventListener('input', updateUI);
    
    // Обробник кліку поза елементами для приховування клавіатури
    document.addEventListener('click', function(e) {
        if (!e.target.matches('input, button, select, tr')) {
            document.activeElement.blur();
        }
    });
}

function switchTab(e) {
    // Видалити клас active з усіх вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Додати клас active до поточної вкладки
    e.target.classList.add('active');
    
    // Приховати всі вмісти вкладок
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Показати вміст поточної вкладки
    const tabId = e.target.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
    
    // Оновити UI після зміни вкладки
    updateUI();
    
    // Якщо це вкладка "Сканування", фокусуємо поле SKU
    if (tabId === 'scan') {
        document.getElementById('sku-input').focus();
    }
}

function handleSkuInput() {
    const skuInput = document.getElementById('sku-input');
    const sku = skuInput.value.trim();
    
    if (!sku) {
        showToast('Введіть артикул товару');
        vibrate();
        return;
    }
    
    // Пошук товару за SKU
    currentItem = items.find(item => item.sku === sku);
    
    if (currentItem) {
        // Товар знайдено
        updateItemCard(currentItem);
        document.getElementById('quantity-input').disabled = false;
        document.getElementById('quantity-submit').disabled = false;
        document.getElementById('quantity-input').focus();
        showToast(`Знайдено: ${currentItem.name}`);
    } else {
        // Товар не знайдено - запит на створення нового
        const itemName = prompt('Товар не знайдено. Введіть назву нового товару:');
        
        if (itemName && itemName.trim()) {
            currentItem = {
                sku: sku,
                name: itemName.trim(),
                expectedQuantity: 0,
                actualQuantity: null,
                status: STATUS.UNCHECKED
            };
            
            items.push(currentItem);
            saveItemToDB(currentItem).catch(error => {
                console.error('Помилка при збереженні товару:', error);
            });
            
            updateItemCard(currentItem);
            document.getElementById('quantity-input').disabled = false;
            document.getElementById('quantity-submit').disabled = false;
            document.getElementById('quantity-input').focus();
            showToast('Новий товар додано');
            
            // Оновити загальний UI
            updateUI();
        } else {
            showToast('Скасування створення нового товару');
            vibrate();
        }
    }
    
    skuInput.value = '';
}

function handleQuantityInput() {
    if (!currentItem) {
        showToast('Спочатку знайдіть товар за артикулом');
        vibrate();
        return;
    }
    
    const quantityInput = document.getElementById('quantity-input');
    const quantityStr = quantityInput.value.trim();
    
    if (!quantityStr) {
        showToast('Введіть кількість');
        vibrate();
        return;
    }
    
    let quantity = parseInt(quantityStr, 10);
    
    if (isNaN(quantity)) {
        showToast('Невірний формат кількості');
        vibrate();
        return;
    }
    
    // Обробка спеціального формату для віднімання (0+число)
    if (quantityStr.startsWith('0') && quantityStr.length > 1) {
        quantity = -parseInt(quantityStr.substring(1), 10);
    }
    
    // Оновити фактичну кількість
    if (currentItem.actualQuantity === null) {
        currentItem.actualQuantity = quantity;
    } else {
        currentItem.actualQuantity += quantity;
    }
    
    // Переконатися, що кількість не від'ємна
    if (currentItem.actualQuantity < 0) {
        currentItem.actualQuantity = 0;
    }
    
    // Оновити статус товару
    currentItem.status = calculateStatus(currentItem);
    
    // Зберегти зміни
    saveItemToDB(currentItem).catch(error => {
        console.error('Помилка при збереженні товару:', error);
    });
    
    // Оновити UI
    updateItemCard(currentItem);
    updateUI();
    
    // Скинути поле введення та повернути фокус на SKU
    quantityInput.value = '';
    document.getElementById('sku-input').focus();
    
    showToast(`Оновлено: ${currentItem.name}`);
}

function calculateStatus(item) {
    if (item.actualQuantity === null) {
        return STATUS.UNCHECKED;
    }
    
    if (item.actualQuantity === item.expectedQuantity) {
        return STATUS.MATCH;
    } else if (item.actualQuantity < item.expectedQuantity) {
        return STATUS.SHORTAGE;
    } else {
        return STATUS.EXCESS;
    }
}

function updateItemCard(item) {
    const itemCard = document.getElementById('item-card');
    itemCard.classList.remove('hidden');
    
    // Оновлюємо клас статусу
    itemCard.querySelector('.checkout').className = `card checkout status-${item.status.toLowerCase().replace(' ', '-')}`;
    
    // Заповнюємо дані
    document.querySelector('#item-card .sku-value').textContent = item.sku;
    document.querySelector('#item-card .item-name').textContent = item.name;
    document.querySelector('#item-card .expected-value').textContent = item.expectedQuantity;
    document.querySelector('#item-card .actual-value').textContent = 
        item.actualQuantity !== null ? item.actualQuantity : '—';
    document.querySelector('#item-card .cost-value').textContent = item.cost.toFixed(2);
    document.querySelector('#item-card .status-value').textContent = item.status;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length === 0) {
                showToast('Файл не містить даних');
                return;
            }
            
            items = [];
            
            jsonData.forEach(row => {
                let sku, name, expected, cost = 0, photo = '';
                
                for (const key in row) {
                    const value = row[key];
                    const keyLower = key.toLowerCase();
                    
                    if (typeof value === 'string' || typeof value === 'number') {
                        if (keyLower.includes('артикул')) {
                            sku = String(value).trim();
                        } else if (keyLower.includes('назва')) {
                            name = String(value).trim();
                        } else if (keyLower.includes('залишок')) {
                            expected = typeof value === 'number' ? value : parseInt(value, 10) || 0;
                        } else if (keyLower.includes('собівартість') || keyLower.includes('cost')) {
                            cost = typeof value === 'number' ? value : parseFloat(value) || 0;
                        }
                    }
                }
                
                if (!sku) return;
                if (!name) name = sku;
                
                items.push({
                    sku: sku,
                    name: name,
                    expectedQuantity: expected,
                    actualQuantity: null,
                    cost: cost,
                    status: STATUS.UNCHECKED
                });
            });
            
            fileMetadata = {
                name: file.name,
                date: new Date().toLocaleString(),
                totalItems: items.length
            };
            
            updateFileInfo();
            
            Promise.all([
                saveAllItemsToDB(),
                saveMetadataToDB(fileMetadata)
            ]).then(() => {
                showToast(`Файл завантажено: ${items.length} товарів`);
                updateUI();
            }).catch(error => {
                console.error('Помилка при збереженні даних:', error);
                showToast('Помилка при збереженні даних');
            });
            
        } catch (error) {
            console.error('Помилка при обробці файлу:', error);
            showToast('Помилка при обробці файлу');
        }
    };
    
    reader.onerror = function() {
        showToast('Помилка при читанні файлу');
    };
    
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function updateFileInfo() {
    const fileInfo = document.getElementById('file-info');
    
    if (fileMetadata.name) {
        fileInfo.classList.remove('hidden');
        document.getElementById('file-name').textContent = fileMetadata.name;
        document.getElementById('file-date').textContent = fileMetadata.date;
    } else {
        fileInfo.classList.add('hidden');
    }
}

function saveResultsToFile() {
    if (items.length === 0) {
        showToast('Немає даних для збереження');
        return;
    }
    
    try {
        const wb = XLSX.utils.book_new();
        
        const exportData = items.map(item => ({
            'Артикул': item.sku,
            'Назва': item.name,
            'Залишок': item.expectedQuantity,
            'Фактично': item.actualQuantity !== null ? item.actualQuantity : '',
            'Статус': item.status,
            'Різниця': item.actualQuantity !== null ? item.actualQuantity - item.expectedQuantity : '',
            'Собівартість': item.cost
        }));
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Інвентаризація');
        
        const metadata = [
            ['Файл інвентаризації', ''],
            ['Початковий файл', fileMetadata.name || 'Невідомо'],
            ['Дата завантаження', fileMetadata.date || 'Невідомо'],
            ['Дата експорту', new Date().toLocaleString()],
            ['', ''],
            ['Статистика', ''],
            ['Всього товарів', items.length],
            ['Перевірено', items.filter(item => item.status !== STATUS.UNCHECKED).length],
            ['Відповідність', items.filter(item => item.status === STATUS.MATCH).length],
            ['Нестача', items.filter(item => item.status === STATUS.SHORTAGE).length],
            ['Надлишок', items.filter(item => item.status === STATUS.EXCESS).length],
            ['', ''],
            ['Фінансові показники', ''],
            ['Загальна собівартість залишку', items.reduce((sum, item) => sum + (item.expectedQuantity * item.cost), 0)],
            ['Фактична собівартість', items.reduce((sum, item) => sum + ((item.actualQuantity || 0) * item.cost), 0)],
            ['Різниця у грошовому вираженні', items.reduce((sum, item) => sum + (((item.actualQuantity || 0) - item.expectedQuantity) * item.cost), 0)]
        ];
        
        const metadataWs = XLSX.utils.aoa_to_sheet(metadata);
        XLSX.utils.book_append_sheet(wb, metadataWs, 'Метадані');
        
        const fileName = `Інвентаризація_${formatDateForFileName(new Date())}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast('Файл збережено: ' + fileName);
    } catch (error) {
        console.error('Помилка при збереженні файлу:', error);
        showToast('Помилка при збереженні файлу');
    }
}

function formatDateForFileName(date) {
    const pad = num => num.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function confirmClearData() {
    if (confirm('Ви впевнені, що хочете очистити всі дані інвентаризації? Цю дію неможливо скасувати.')) {
        clearData();
    }
}

function clearData() {
    // Очистити локальні дані
    items = [];
    currentItem = null;
    fileMetadata = {
        name: '',
        date: '',
        totalItems: 0
    };
    
    // Очистити UI
    document.getElementById('item-card').classList.add('hidden');
    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('sku-input').value = '';
    document.getElementById('quantity-input').value = '';
    document.getElementById('quantity-input').disabled = true;
    document.getElementById('quantity-submit').disabled = true;
    
    // Очистити IndexedDB
    Promise.all([
        clearItemsDB(),
        clearMetadataDB()
    ]).then(() => {
        showToast('Всі дані очищено');
        updateUI();
    }).catch(error => {
        console.error('Помилка при очищенні даних:', error);
        showToast('Помилка при очищенні даних');
    });
}

function updateUI() {
    // Оновити таблицю товарів
    renderTable();
    
    // Оновити таблицю результатів
    renderResultsTable();
    
    // Оновити прогрес та статистику
    updateProgressAndStats();
    
    // Оновити стан кнопок управління
    updateControlStates();
}

function renderTable() {
    const tableBody = document.querySelector('#items-table tbody');
    tableBody.innerHTML = '';
    
    // Отримати поточні фільтри
    const statusFilter = document.getElementById('status-filter').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    
    // Фільтрувати товари
    const filteredItems = items.filter(item => {
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchesSearch = searchQuery === '' || 
            item.name.toLowerCase().includes(searchQuery) || 
            item.sku.toLowerCase().includes(searchQuery);
        return matchesStatus && matchesSearch;
    });
    
    // Додати товари до таблиці
    filteredItems.forEach(item => {
        const row = document.createElement('tr');
        row.dataset.sku = item.sku;
        
        // Додати обробники подій для рядка
        row.addEventListener('click', () => {
            // Перейти на вкладку "Сканування" з вибраним SKU
            document.querySelector('.tab[data-tab="scan"]').click();
            document.getElementById('sku-input').value = item.sku;
            handleSkuInput();
        });
        
        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Перейти на вкладку "Сканування" з вибраним SKU та фокусом на кількості
            document.querySelector('.tab[data-tab="scan"]').click();
            document.getElementById('sku-input').value = item.sku;
            handleSkuInput();
            document.getElementById('quantity-input').focus();
        });
        
        // Статус
        const statusCell = document.createElement('td');
        statusCell.className = 'status-cell';
        
        const statusDot = document.createElement('div');
        statusDot.className = 'status-dot';
        statusDot.classList.add(`status-${item.status.toLowerCase().replace(' ', '-')}`);
        statusDot.style.backgroundColor = STATUS_COLORS[item.status] || STATUS_COLORS[STATUS.UNCHECKED];
        
        const statusText = document.createElement('span');
        statusText.textContent = item.status;
        
        statusCell.appendChild(statusDot);
        statusCell.appendChild(statusText);
        row.appendChild(statusCell);
        
        // Артикул
        const skuCell = document.createElement('td');
        skuCell.textContent = item.sku;
        row.appendChild(skuCell);
        
        // Назва
        const nameCell = document.createElement('td');
        nameCell.textContent = item.name;
        row.appendChild(nameCell);
        
        // Очікувано
        const expectedCell = document.createElement('td');
        expectedCell.textContent = item.expectedQuantity;
        row.appendChild(expectedCell);
        
        // Фактично
        const actualCell = document.createElement('td');
        actualCell.textContent = item.actualQuantity !== null ? item.actualQuantity : '—';
        row.appendChild(actualCell);
        
        tableBody.appendChild(row);
    });
}

function renderResultsTable() {
    const tableBody = document.querySelector('#results-table tbody');
    tableBody.innerHTML = '';
    
    // Відфільтрувати товари з розбіжностями
    const discrepantItems = items.filter(item => 
        item.status === STATUS.SHORTAGE || item.status === STATUS.EXCESS
    );
    
    // Оновити кількість розбіжностей
    document.getElementById('discrepancies-count').textContent = discrepantItems.length;
    
    // Додати товари до таблиці результатів
    discrepantItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Статус
        const statusCell = document.createElement('td');
        statusCell.className = 'status-cell';
        
        const statusDot = document.createElement('div');
        statusDot.className = 'status-dot';
        statusDot.classList.add(`status-${item.status.toLowerCase().replace(' ', '-')}`);
        statusDot.style.backgroundColor = STATUS_COLORS[item.status] || STATUS_COLORS[STATUS.UNCHECKED];
        
        const statusText = document.createElement('span');
        statusText.textContent = item.status;
        
        statusCell.appendChild(statusDot);
        statusCell.appendChild(statusText);
        row.appendChild(statusCell);
        
        // Артикул
        const skuCell = document.createElement('td');
        skuCell.textContent = item.sku;
        row.appendChild(skuCell);
        
        // Назва
        const nameCell = document.createElement('td');
        nameCell.textContent = item.name;
        row.appendChild(nameCell);
        
        // Очікувано
        const expectedCell = document.createElement('td');
        expectedCell.textContent = item.expectedQuantity;
        row.appendChild(expectedCell);
        
        // Фактично
        const actualCell = document.createElement('td');
        actualCell.textContent = item.actualQuantity !== null ? item.actualQuantity : '—';
        row.appendChild(actualCell);
        
        // Різниця
        const difference = item.actualQuantity !== null ? item.actualQuantity - item.expectedQuantity : 0;
        const differenceCell = document.createElement('td');
        differenceCell.textContent = difference;
        differenceCell.classList.add(difference >= 0 ? 'difference-positive' : 'difference-negative');
        row.appendChild(differenceCell);
        
        tableBody.appendChild(row);
    });
}

function updateProgressAndStats() {
    if (items.length === 0) {
        document.querySelector('.progress-fill').style.width = '0%';
        document.getElementById('total-count').textContent = '0';
        document.getElementById('checked-count').textContent = '0';
        document.getElementById('ok-count').textContent = '0';
        document.getElementById('shortage-count').textContent = '0';
        document.getElementById('excess-count').textContent = '0';
        return;
    }
    
    const checkedCount = items.filter(item => item.status !== STATUS.UNCHECKED).length;
    const progress = (checkedCount / items.length) * 100;
    
    document.querySelector('.progress-fill').style.width = `${progress}%`;
    document.getElementById('total-count').textContent = items.length;
    document.getElementById('checked-count').textContent = checkedCount;
    document.getElementById('ok-count').textContent = items.filter(item => item.status === STATUS.MATCH).length;
    document.getElementById('shortage-count').textContent = items.filter(item => item.status === STATUS.SHORTAGE).length;
    document.getElementById('excess-count').textContent = items.filter(item => item.status === STATUS.EXCESS).length;
}

function updateControlStates() {
    const hasItems = items.length > 0;
    document.getElementById('save-results').disabled = !hasItems;
    document.getElementById('clear-data').disabled = !hasItems;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function vibrate() {
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
    }
}
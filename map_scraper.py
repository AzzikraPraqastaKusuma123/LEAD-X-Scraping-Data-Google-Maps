import sys
import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import NoSuchElementException, TimeoutException
import re # Modul baru untuk regular expression

# ... (bagian initialize_driver, scroll_results, scrape_email_from_website tetap sama persis) ...
# ==================================================================================
# --- PENGATURAN & KONFIGURASI ---
# ==================================================================================
CHROME_DRIVER_PATH = './chromedriver.exe' 
RESTART_BROWSER_AFTER_QUERIES = 2

SELECTORS = {
    "business_link_container": "a.hfpxzc",
    "detail_business_name": "h1.DUwDvf",
    "detail_address": "button[data-item-id='address']",
    "detail_phone": "button[data-item-id*='phone']",
    "detail_website": "a[data-item-id='authority']",
    #SELECTOR BARU UNTUK MENGAMBIL JUMLAH ULASAN
    "review_count_button": "button.DkEaL" 
}
# ==================================================================================

def send_update(type, payload):
    message = json.dumps({"type": type, "payload": payload})
    print(message)
    sys.stdout.flush()

def initialize_driver():
    send_update("status", "🚀 Memulai sesi browser baru...")
    chrome_options = Options()
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    chrome_options.add_argument("--start-maximized"); chrome_options.add_argument("--log-level=3")
    chrome_options.add_argument('--blink-settings=imagesEnabled=false'); chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox"); chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    service = Service(executable_path=CHROME_DRIVER_PATH)
    return webdriver.Chrome(service=service, options=chrome_options)

def scroll_results(driver):
    try:
        panel = driver.find_element(By.CSS_SELECTOR, "div[role='feed']")
        for _ in range(3):
            send_update("status", "Scrolling untuk memuat semua link...")
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", panel)
            time.sleep(4)
    except Exception:
        send_update("warning", "Panel scroll tidak ditemukan.")

def scrape_email_from_website(driver, url):
    try:
        send_update("status", f"🔎 Mengunjungi {url} untuk mencari email...")
        driver.set_page_load_timeout(15)
        driver.get(url)
        time.sleep(3)
        links = driver.find_elements(By.TAG_NAME, "a")
        for link in links:
            href = link.get_attribute('href')
            if href and "mailto:" in href:
                email = href.replace("mailto:", "").split("?")[0]
                send_update("status", f"✅ Email ditemukan: {email}")
                return email
        return "N/A"
    except TimeoutException:
        send_update("warning", "Website terlalu lama dimuat, dilewati.")
        return "Timeout"
    except Exception:
        send_update("warning", f"Gagal mengakses website: {url}")
        return "Gagal Diakses"

def extract_detailed_data(driver):
    """VERSI BARU: Mengekstrak data lengkap TERMASUK jumlah ulasan."""
    data = {'nama': 'N/A', 'alamat': 'N/A', 'telepon': 'N/A', 'website': 'Tidak Ada', 'email': 'N/A', 'jumlah_ulasan': 0}
    
    try: data['nama'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_business_name"]).text
    except: pass
    try: data['alamat'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_address"]).get_attribute('aria-label').replace('Alamat: ', '').strip()
    except: pass
    try: data['telepon'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_phone"]).get_attribute('aria-label').replace('Telepon: ', '').strip()
    except: pass
    try: data['website'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_website"]).get_attribute('href')
    except: pass
    
    # LOGIKA BARU UNTUK MENGAMBIL JUMLAH ULASAN
    try:
        review_button = driver.find_element(By.CSS_SELECTOR, SELECTORS["review_count_button"])
        review_text = review_button.get_attribute('aria-label') # Cth: "4,5 bintang 1.345 ulasan"
        # Gunakan regex untuk mengambil hanya angka ulasan
        match = re.search(r'([\d.,]+)\sulasan', review_text)
        if match:
            # Bersihkan angka dari titik atau koma ribuan dan ubah jadi integer
            review_count_str = match.group(1).replace('.', '').replace(',', '')
            data['jumlah_ulasan'] = int(review_count_str)
    except:
        data['jumlah_ulasan'] = 0


    if data['website'] != 'Tidak Ada' and not any(domain in data['website'] for domain in ["instagram.com", "facebook.com", "tokopedia.com"]):
        data['email'] = scrape_email_from_website(driver, data['website'])
        
    return data

def main(queries):
    # ... (Fungsi main tetap sama persis seperti sebelumnya) ...
    driver = initialize_driver()
    for i, query in enumerate(queries):
        if i > 0 and i % RESTART_BROWSER_AFTER_QUERIES == 0:
            send_update("status", "🔄 Merestart browser untuk menjaga stabilitas...")
            driver.quit()
            driver = initialize_driver()
        send_update("status", f"Memulai pencarian: '{query}' ({i+1}/{len(queries)})...")
        try:
            search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
            driver.get(search_url)
            time.sleep(5)
            scroll_results(driver)
            link_elements = driver.find_elements(By.CSS_SELECTOR, SELECTORS["business_link_container"])
            business_links = [link.get_attribute('href') for link in link_elements if link.get_attribute('href')]
            send_update("status", f"Ditemukan {len(business_links)} link bisnis. Mengunjungi satu per satu...")
            for j, link in enumerate(business_links):
                send_update("status", f"Memproses link #{j+1} dari {len(business_links)}...")
                driver.get(link)
                time.sleep(5)
                scraped_data = extract_detailed_data(driver)
                send_update("data", scraped_data)
        except Exception as e:
            send_update("error", f"Terjadi error pada '{query}': {str(e)}")
            continue
    send_update("status", "Semua pekerjaan selesai!")
    driver.quit()


if __name__ == "__main__":
    queries_from_args = sys.argv[1:]
    if queries_from_args:
        main(queries_from_args)
    else:
        send_update("error", "Skrip ini harus dijalankan dari aplikasi UI dengan target pencarian.")
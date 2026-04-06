import sys
import json
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from bs4 import BeautifulSoup

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
    "review_count_button": "button.DkEaL" 
}
# ==================================================================================

def send_update(type, payload):
    """Fungsi pusat untuk mengirim update ke UI dalam format JSON."""
    message = json.dumps({"type": type, "payload": payload})
    print(message)
    sys.stdout.flush()

def initialize_driver():
    """Membuat dan mengembalikan instance driver Chrome baru."""
    send_update("status", "🚀 Memulai sesi browser baru...")
    chrome_options = Options()
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_argument('--blink-settings=imagesEnabled=false')
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    return webdriver.Chrome(options=chrome_options)

def scroll_results(driver):
    """Scroll panel hasil pencarian untuk memuat semua link bisnis."""
    try:
        panel = driver.find_element(By.CSS_SELECTOR, "div[role='feed']")
        for _ in range(3):
            send_update("status", "Scrolling...")
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", panel)
            time.sleep(4)
    except Exception:
        send_update("warning", "Panel scroll tidak ditemukan.")

def analyze_website(driver, url):
    """Mengunjungi website untuk mencari email, medsos, dan teknologi."""
    details = {'email': 'N/A', 'social_media': {}, 'tech_stack': 'Unknown'}
    try:
        send_update("status", f"🔎 Menganalisis {url}...")
        driver.set_page_load_timeout(15)
        driver.get(url)
        time.sleep(3)
        
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'lxml')
        
        # 1. Cari Email & Media Sosial dari semua link
        for link in soup.find_all('a', href=True):
            href = link['href']
            if "mailto:" in href and details['email'] == 'N/A':
                details['email'] = href.replace("mailto:", "").split("?")[0]
            if "instagram.com" in href and 'instagram' not in details['social_media']:
                details['social_media']['instagram'] = href
            if "facebook.com" in href and 'facebook' not in details['social_media']:
                details['social_media']['facebook'] = href
            if "linkedin.com" in href and 'linkedin' not in details['social_media']:
                details['social_media']['linkedin'] = href

        # 2. Deteksi Teknologi Website (Footprinting)
        if "wp-content" in page_source or "wp-includes" in page_source:
            details['tech_stack'] = "WordPress"
        elif "cdn.shopify.com" in page_source or "Shopify" in page_source:
            details['tech_stack'] = "Shopify"
        elif "wix.com" in page_source or "wixstatic" in page_source:
            details['tech_stack'] = "Wix"
        
        return details
    except TimeoutException:
        send_update("warning", "Website terlalu lama dimuat.")
        return {"email": "Timeout", "social_media": {}, "tech_stack": "Unknown"}
    except Exception:
        send_update("warning", f"Gagal menganalisis website.")
        return {"email": "Gagal Diakses", "social_media": {}, "tech_stack": "Unknown"}

def extract_detailed_data(driver):
    """Mengekstrak data dari halaman detail dan memanggil fungsi analisis website."""
    data = {'nama': 'N/A', 'alamat': 'N/A', 'telepon': 'N/A', 'website': 'Tidak Ada', 
            'email': 'N/A', 'jumlah_ulasan': 0, 'social_media': {}, 'tech_stack': 'N/A'}
    
    try: data['nama'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_business_name"]).text
    except: pass
    try: data['alamat'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_address"]).get_attribute('aria-label').replace('Alamat: ', '').strip()
    except: pass
    try: data['telepon'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_phone"]).get_attribute('aria-label').replace('Telepon: ', '').strip()
    except: pass
    try: data['website'] = driver.find_element(By.CSS_SELECTOR, SELECTORS["detail_website"]).get_attribute('href')
    except: pass
    try:
        review_text = driver.find_element(By.CSS_SELECTOR, SELECTORS["review_count_button"]).get_attribute('aria-label')
        match = re.search(r'([\d.,]+)\sulasan', review_text)
        if match:
            data['jumlah_ulasan'] = int(match.group(1).replace('.', '').replace(',', ''))
    except: data['jumlah_ulasan'] = 0

    if data['website'] != 'Tidak Ada' and not any(domain in data['website'] for domain in ["instagram.com", "facebook.com"]):
        website_details = analyze_website(driver, data['website'])
        data.update(website_details)
        
    return data

def main(queries):
    """Fungsi utama yang dipanggil oleh aplikasi Electron."""
    driver = initialize_driver()
    for i, query in enumerate(queries):
        if i > 0 and i % RESTART_BROWSER_AFTER_QUERIES == 0:
            send_update("status", "🔄 Merestart browser...")
            driver.quit()
            driver = initialize_driver()
        send_update("status", f"Memulai: '{query}'...")
        try:
            search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
            driver.get(search_url)
            time.sleep(5)
            scroll_results(driver)
            
            link_elements = driver.find_elements(By.CSS_SELECTOR, SELECTORS["business_link_container"])
            business_links = [link.get_attribute('href') for link in link_elements if link.get_attribute('href')]
            send_update("status", f"Ditemukan {len(business_links)} link. Mengunjungi satu per satu...")

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
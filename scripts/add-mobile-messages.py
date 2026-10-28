"""Adds the strings only the phone app needs to the copied website catalogue.

The website's own sections are used as they are, so both apps say the same thing. Run it again
after editing: it rewrites the `mobile` section and leaves everything else alone.
"""

import io
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'i18n', 'messages')

AR = {
    'close': 'إغلاق',
    'cancel': 'إلغاء',
    'retry': 'إعادة المحاولة',
    'loading': 'جارٍ التحميل',
    'menu': 'القائمة',
    'back': 'رجوع',
    'done': 'تم',
    'share': 'مشاركة',
    'language': 'اللغة',
    'languageName': 'العربية',
    'otherLanguageName': 'English',
    'theme': 'المظهر',
    'themeSystem': 'حسب الجهاز',
    'themeLight': 'فاتح',
    'themeDark': 'داكن',
    'settings': 'الإعدادات',
    'restartNote': 'سيُعاد تشغيل التطبيق لتطبيق اتجاه الشاشة.',
    'sessionExpired': 'انتهت جلستك. سجّل الدخول من جديد.',
    'unavailable': 'تعذّر الاتصال بالخدمة. تحقق من الإنترنت ثم أعد المحاولة.',
    'attach': {
        'title': 'إرفاق',
        'files': 'ملف أو PDF',
        'photos': 'صور من المعرض',
        'camera': 'التقاط صورة',
        'permission': 'اسمح للتطبيق بالوصول من إعدادات الجهاز لإرفاق الصور.',
    },
    'mode': {
        'title': 'نوع الطلب',
        'ask': 'سؤال',
        'memo': 'مذكرة دفاع',
        'review': 'مراجعة عقد',
        'template': 'مستند',
    },
    'article': {
        'copy': 'نسخ النص',
        'copied': 'تم النسخ',
    },
    'draft': {
        'saved': 'تم حفظ الملف.',
        'shareTitle': 'مشاركة المستند',
    },
    'billing': {
        'browserHint': 'بعد إتمام الدفع عُد إلى التطبيق، وسنتحقق من عمليتك.',
        'checkPayment': 'تحقق من الدفع',
        'opening': 'جارٍ فتح صفحة الدفع',
    },
    'legalSoon': 'النص الكامل لهذه الصفحة قيد الإعداد وسيُنشر هنا.',
    'landing': {
        'menuAccount': 'الحساب',
        'goToChat': 'الذهاب إلى المحادثات',
    },
    'sidebar': {
        'title': 'سندك',
        'profile': 'حسابي والاستخدام',
        'plans': 'الباقات والرصيد',
    },
}

EN = {
    'close': 'Close',
    'cancel': 'Cancel',
    'retry': 'Try again',
    'loading': 'Loading',
    'menu': 'Menu',
    'back': 'Back',
    'done': 'Done',
    'share': 'Share',
    'language': 'Language',
    'languageName': 'English',
    'otherLanguageName': 'العربية',
    'theme': 'Appearance',
    'themeSystem': 'Device',
    'themeLight': 'Light',
    'themeDark': 'Dark',
    'settings': 'Settings',
    'restartNote': 'The app will restart to apply the screen direction.',
    'sessionExpired': 'Your session has ended. Sign in again.',
    'unavailable': 'Could not reach the service. Check your internet and try again.',
    'attach': {
        'title': 'Attach',
        'files': 'File or PDF',
        'photos': 'Photos from the library',
        'camera': 'Take a photo',
        'permission': 'Allow access in the device settings to attach photos.',
    },
    'mode': {
        'title': 'Kind of request',
        'ask': 'Question',
        'memo': 'Defence memo',
        'review': 'Contract review',
        'template': 'Document',
    },
    'article': {
        'copy': 'Copy the text',
        'copied': 'Copied',
    },
    'draft': {
        'saved': 'The file was saved.',
        'shareTitle': 'Share the document',
    },
    'billing': {
        'browserHint': 'After you pay, come back to the app and we will check your payment.',
        'checkPayment': 'Check the payment',
        'opening': 'Opening the payment page',
    },
    'legalSoon': 'The full text of this page is being prepared and will be published here.',
    'landing': {
        'menuAccount': 'Account',
        'goToChat': 'Go to conversations',
    },
    'sidebar': {
        'title': 'Sanadak',
        'profile': 'My account and usage',
        'plans': 'Plans and top-ups',
    },
}

for lang, mobile in (('ar', AR), ('en', EN)):
    path = os.path.join(ROOT, lang + '.json')
    data = json.loads(io.open(path, encoding='utf8').read())
    data['mobile'] = mobile
    io.open(path, 'w', encoding='utf8').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('mobile messages ok')

- android
	- kotlin
	- coroutine
	- android studio
	- application, activity and life cycles
	- debug with android studio
	- ~~Gradle and libraries
	- ~~Jetpack compose
	- ~~architectures (MVVM)
	- ~~saving (Room, shared preferences)
	- accesses
	- ~~connection to the network (OKHttp, Retrofit)
	- ~~application test (JUnit, Espresso)~~
	- ~~publishing application
- IOS
	- ~~swfit
	- xcode
	- ~~views (UIKit , SwiftUI)
	- ~~viewmodel and combine
	- ~~structured concurrency
	- ~~saving (CoreData , UserDefaules)
	- ~~connection to the network (URLSession, Alamofire)
	- debugging with xcode 
	- ~~test (SwiftTesting , XCTest)
	- ~~packages and SPM
	- publish app for ios 
- common topics 
	- ~~git / github
	- ~~feature flag 
	- design tools : figma
	- ~~monitoring release : sentry , firebase , metabase
	- ~~Server-driven UI 
	- accessibility
	- security 
 

- MVVM architecture 
	- معماری model , view و viewmodel که توش مدل فقط داده‌هارو در اختیار داره و نسبت به ui کاملا مستقله و صرفا داده‌هارو به viewmodel پاس میده. view فقط ui برنامست و هیچ دسترسی و وابستگی به model نداره صرفا داده‌هایی که نیازه نمایش داده بشه رو از viewmodel میگیره. viewmodel هم یک مغز متفکریه که میاد داده‌هارو از model میگیره و اگه تغییری توی نمایش داده‌ها نیاز بود اون رو publish می‌کنه و بعد view میاد داده جدید رو subscribe می‌کنه و اضافه می‌کنه به ui تا برای کاربر به نمایش در بیاد. 
- jetpack compose
	- composible functions:
		- این تابع‌ها با @composible مشخص میشن. هر ‌ui که با این سیستم ساخته میشه
		   یک تابع با @composible هست. سیستم نوشتن این تابع‌ها مثل لگو‌عه که
		    تیکه تیکه می‌نویسنش
	- layout components:
		- برای چینش عناصر ui ازش استفاده میشه. مثل column, row , 
		  box lazyrow lazycolumn
	- modifier 
		- شبیه chain method هست برای زمانی که نیازه توی ui تغییری انجام بشه.
		   مثل اندازه، فاصله زنگ پس زمینه و این چیزا clickable, background, padding , size
	- state management
		- برای ذخیره و مدیریت state ui مثلا حفظ کردن یک state مشخص یا ساخت state
		   قابل تغییر یا اتصال به ViewModel . مثال‌ها: mutable , mutableStateOf 
	- material design components 
		- مجموعه‌ای از کامپوننت‌های آماده بر اساس material design google
		  Button , text , field , fab , text field , slider 
	- theming
		- برای تنظیم رنگ‌ها، فونت‌ها، سایزها و استایل کلی UI و در کل یکپارچه کردن استایل کل اپ
		  `MaterialTheme` و `Typography`, `Shapes`, `ColorScheme`.
	- navigation
		- کتابخانه **Navigation for Compose** برای مدیریت صفحات و جابه‌جایی.
		   که قابلیت مدیریت و دریافت مسیر‌های مختلف صفحات رو داره. استفاده
		    از `NavHost` و `NavController`.
- connection to the network (OKHttp, Retrofit)
	- OKHttp:
		-  یک کتابخانه قدرتمند و بهینه برای انجام درخواست‌های HTTP (GET, POST و غیره).
		  که از HTTP/2 پشتیبانی‌ می‌کنه، قابلیت connection pooling داره به این معنی که از ارتباط‌ها مجددا میشه برای سرعت بیشتر استفاده کرد، از websocket پشتیبانی می‌کنه و cache داخلی داره 
	- Retrofit:
		- یک کتابخانه سطح بالاتر برای ارتباط شبکه، ساخته شده روی **OKHttp**. هدفش ساده کردن کار با APIها و تبدیل پاسخ‌ها به **Object**‌های Kotlin/Java هست. از ویژگی‌هاش اینه که تبدیل اتومات پاسخ JSON به کلاس داده داره و میشه API به صورت یک **Interface** ساده بدون مدیریت Request/Response دستی رو باهاش پیاده‌سازی کرد.
- Gradle and libraries:
	- دو مدل فایل کانفیگ gradle داریم: 
	- **Project-level Gradle** → `build.gradle` یا `build.gradle.kts`
		- تنظیمات کلی پروژه + تعریف gradle plugin ها + library repositories 
	- **Module-level Gradle** → `app/build.gradle` یا `app/build.gradle.kts`
		-  تنظیمات در لول و سطح ماژول + پلاگین‌هایی که استفاده شده و dependencyها و SDK version
	- کاربرد‌های gradle:
		- اتوماتیک شدن مراحل build
		- مدیریت‌کردن نسخه‌های اپلیکیشن و ورژن دپندنسی‌هایی که داره استفاده میشه 
		- امکان پیاده‌سازی جند ماژول 
		- تعریف ماژول اینجا هر قطعه کدی هست که به تنهایی قابل اجرا و بیلد شدن باشه و خروجی بده (یک واحد مستقل کد)

- coroutine
	- یک پیاده‌سازی سبک‌تر و سریع‌تر از thread های مختلف که باهاش concurrency و async function بجای استفاده از thread استفاده میشه 
	- مفاهیم coroutine: 
		- suspend functions: توابع معلق که میشه وسط اجراشون «مکث» کرد و بعد ادامه داد بدون بلاک کردن ترد
		- coroutine scope: 
			- global scope: برای کار‌های کلی اما ممکنه memory leak اتفاق بیفته
			- viewmodel scope: مخصوص android viewmodel
			- lifecycle scope: مخصوص activity / fragment
		- launch & async: 
			- launch: کار‌هایی که مقدار خروجی رو برنمی‌گردونه 
			- async: کار‌هایی که مقدار خروجی رو با استفاده از تابع await میشه گرفت
		- dispatchers: تعیین میشه چه جا‌هایی قراره coroutine اجرابشه 
		- نکته: توی coroutine ها امکان لغو کردن یک async یا launch وجود داره و زمانی که دستی لغو بشه کلا kill میشه و تسک‌هایی که تا اون لحظه پروسس شده بودن هم لغو می‌شن همشون
- saving (Room, shared preferences)
	- room database: 
		- یک **SQLite Database** با روکش مدرن Kotlin/Java که توسط Google پیشنهاد شده.
		  با Room دیگه مستقیم سراغ کوئری‌های خام SQLite نمی‌ری، همه‌چیز Type-safe و Annotated هست.
		- اجرای room: 
		- entity: جدول دیتابیس
		- DAO data access object: اینترفیس یا کلاسی برای کوئری‌ها 
		- database: نقطه دسترسی دستی
	- shared preferences: 
		- یک فایل **Key-Value Store** سبک در حافظه داخلی گوشی برای ذخیره‌های ساده و کوچک و داده‌های پر استفاده و تنظیمات کاربر و token ها. همون کش خودمونه تنها نکته‌ای که داره اینه که داده‌ها plain text ذخیره میشن
- flow:
	- cold flow: تا collect نکنی اجرا نمیشه. cold stream
	- state flow:همیشه آخرین مقدار رو نگه می‌داره (مشابه LiveData) hot stream
	- shared flow:  بدون نگهداری آخرین مقدار (مثل event bus). hot stream 



- monitoring in mobile programming
	- سه نوع متریک داریم برای بررسی و مانیتور کردن یک اپلیکیشن:
		- متریک پایداری اپ up time 
			- crash-free rate
				- Nc: number of crash sessions
				- Ntotal: number of total sessions
				- crash free sessions![[Pasted image 20250823120729.png]]
		- متریک عملکرد performance
			- مصرف منابع 
			- ریسپانس تایم apdex
					- Time-based (response time, launch time)
				    - Define threshold duration T
				    - Nsat: Number of satisfied samples (under T)
				    - Ntol: Number of tolerating samples (up to 4.T)
				    - Ntotal: Number of total samples
				    - ![[Pasted image 20250823121040.png]]
		- متریک محصولی business
			- بسته به دامنه هر کسب و کار متفاوته 


- انتشار اپ: 
	- انتشار آلفا
		- داخل شرکت 
		- با ریسک پایین و بدون هزینه برای بازگشت به نسخه قبلی
	- انتشار بتا
		- خارج از سازمان 
		- برای جامعه کوچکی از کاربران 
		- دارای ریسک بالاتر اما مدیریت شده با هزینه کم 
	- ریلیز نهایی
		- انتشار برای تمامی کاربران
		- دارای ریسک بالا و هزینه زیاد برای برگشت به نسخه قبلی 
	- هات فیکس 
		- انتشار ورژن جدید در صورت مشکل خورد ریلیز نهایی 
		- زمان در این نوع ریلیز بسیار زیاد اهمیت دارد 
		- ریشه‌یابی مشکلات نوشتن پست مرتم و ... 
![[Pasted image 20250823123840.png]]


- app components: 
	- activities
		- صفحه UI که کاربر با آن تعامل دارد 
		- نمایش داده ها و دریافت ورودی‌های کاربر 
	- services
		- کار‌های که در پس‌زمینه بدون UI انجام می‌شود مثل پخش موسیقی یا سینک کردن دیتا با سرور
	- broadcast receivers
		- کامپوننتی هست که منتظر دریافت پیام از سیستم‌ یا اپ‌های دیگر هست 
		- مثل مثلا ایونت شارژ شدن دستگاه موبایل
	- content providers 
		- واسط برای به‌اشتراک‌گذاری داده بین اپ‌ها یا بین بخش‌های مختلف یک اپ.
		  - دسترسی به داده‌های کانتکت‌ها، گالری، و دیتابیس‌ها.
-
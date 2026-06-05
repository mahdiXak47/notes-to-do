## روند صدور گواهی SSL

صدور گواهی با استفاده از  let's encrypt در سمت همروش انجام می شود، و با استفاده از ACME Protocol و به دو نوع انجام این کار امکان پذیر خواهد بود: 

- **با استفاده از 01-HTTP:**  
- با
    
 این نوع چالش HTTP-01 امروزه بیشترین استفاده را دارد. Let’s Encrypt یک token به ACME client ارائه می‌دهد، و ACME client یک فایل را در سرور وب خود در آدرس http://<YOUR_DOMAIN>/.well-known/acme-challenge/<TOKEN> قرار می‌دهد. این فایل شامل token و یک thumbprint از کلید حساب Let’s Encrypt است. هنگامی که ACME client به Let’s Encrypt اطلاع می‌دهد که فایل آماده است، Let’s Encrypt تلاش می‌کند آن را دریافت کند (احتمالاً چندین بار). اگر چک‌های اعتبارسنجی از سرور وب پاسخ‌های صحیح را بدست آورند، اعتبارسنجی موفق تلقی می‌شود و  گواهی می تواند صادر شود. اگر چک‌های اعتبارسنجی شکست بخورند، باید دوباره با یک گواهی جدید challenge شروع شود.
    
 پیاده‌سازی با استفاده از چالش HTTP-01 ، تا عمق 10 مرحله می تواند redirect را داشته باشد. و تنها redirect های "http:" یا "https:" را پذیرفته و تنها به پورت‌های 80 و 443 هدایت می‌شود. ضمن آنکه redirect با استفاده از آدرس‌های IP مجاز نیست. هنگامی که به یک HTTPS URL انتقال انجام می شود،  لزومی بر تایید شدن گواهی‌نامه‌ها وجود ندارد (زیرا این چالش برای راه‌اندازی گواهی‌نامه‌های معتبر است، ممکن است در طول راه گواهی‌نامه‌های منقضی شده وجود داشته باشد).
    
چالش HTTP-01 تنها می‌تواند بر روی پورت 80 انجام شود. اما می توان به مشتریان اجازه داد که پورت دلخواه را برای این چالش انتخاب کنند اما از امنیت می کاهد ، بنابراین توسط استاندارد ACME مجاز نیست.
    
    مزایا:
    
    - آسان برای اتوماسیون بدون دانش اضافی درباره پیکربندی یک دامنه است.
    - به ارائه‌دهندگان میزبانی برای صادر کردن گواهی‌نامه برای دامنه‌های CNAMEd اجازه می دهد.
    - با سرورهای وب عمومی کار می‌کند.
    
    معایب:
    
    - اگر ISP پورت 80 را مسدود کند، کار نمی‌کند (این واقعه نادری است، اما برخی از ارائه‌دهندگان ISP این کار را انجام می‌دهند).
    - Let's Encrypt به شما اجازه استفاده از این چالش برای صادر کردن گواهی‌نامه‌های جایگزین نمی‌دهد.
    - اگر شما چندین سرور وب داشته باشید، باید اطمینان حاصل کنید که فایل بر روی همه آن‌ها در دسترس است.

دریافت گواهی SSL با استفاده از HTTP Challenge یک روش از روش‌های تأیید اعتبار دامنه (Domain Validation) است که توسط Certificate Authority (CA) مورد استفاده قرار می‌گیرد. در ادامه فرایند دریافت گواهی SSL با HTTP Challenge توضیح داده می‌شود:  
  

- - **درخواست گواهی SSL**: ابتدا باید یک درخواست برای دریافت گواهی SSL برای دامنه مورد نظر ارسال شود. این مرحله شامل ارسال اطلاعات و احراز هویت به CA است.
    - **دریافت HTTP Challenge**: پس از ارسال درخواست، CA یک HTTP Challenge به client ارسال می‌کند. این HTTP Challenge ممکن است شامل یک فایل مشخص یا یک رشته‌ی مشخص در محتوای صفحه وب باشد.
    - **اعتبارسنجی HTTP Challenge**: برای اعتبارسنجی، باید فایل یا رشته مشخص مربوط به HTTP Challenge در مسیر یا محتوای مشخص در وب‌سایت قرار گیرد. این فایل یا رشته نشان دهنده این است که کنترل کامل بر دامنه مورد اعتبارسنجی وجود دارد.
    - **تأیید اجرای HTTP Challenge**: پس از قرار دادن فایل یا رشته مشخص بر روی وب‌سایت، باید به CA اعلام شود که این Challenge اجرا شده است. CA سپس صفحه وب را بررسی می‌کند تا مطمئن شود که چالش اجرا شده است.
    - **دریافت گواهی SSL**: پس از اتمام مراحل فوق و تأیید CA از اجرای موفقیت‌آمیز HTTP Challenge، گواهی SSL برای دامنه صادر می‌شود.  
          
        

- **با استفاده از DNS:  
    **این چالش از شما می‌خواهد که با قرار دادن یک مقدار خاص در یک رکورد TXT تحت آن نام دامنه، ثابت کنید که DNS را برای نام دامنه خود کنترل می‌کنید. پیکربندی آن از HTTP-01 سخت تر است، اما می تواند در سناریوهایی کار کند که HTTP-01 قادر به انجام آن نیست. همچنین به شما امکان می دهد گواهی نامه های wildcard صادر کنید. پس از اینکه Let’s Encrypt به مشتری ACME شما یک توکن داد، مشتری شما یک رکورد TXT مشتق شده از آن نشانه و کلید حساب شما ایجاد می کند و آن رکورد را acme-challenge.yourdomain.com_ قرار می دهد. سپس Let’s Encrypt سیستم DNS را برای آن رکورد پرس و جو می کند. اگر مطابقت پیدا کرد می توانید نسبت به صدور گواهی اقدام کنید!  
      
    مرحله به مرحله برای دریافت SSL از طریق DNS-01 challenge، می‌توانید مراحل زیر را دنبال کنید:  
    - **ثبت درخواست SSL**: شما ابتدا باید یک درخواست SSL از یک سرویس صدور گواهی معتبر (مانند Let's Encrypt یا Certbot) ثبت کنید. این درخواست شامل اطلاعات دامنه و سرور شما است.
    - **دریافت اطلاعات اعتبارسنجی**: پس از ثبت درخواست، سیستم صدور گواهی شما یک کد اعتبارسنجی یکتا به شما ارائه خواهد کرد، که باید به نحوی در رکوردهای DNS خود اعمال کنید.
    - **اعمال تغییرات DNS**: یک رکورد TXT جدید بسازید با مقدار موردنیاز برای تأیید اعتبارسنجی (معمولاً شامل کد ارائه شده توسط سیستم صدور گواهی است)
    - **تأیید تغییرات DNS**: پس از اعمال تغییرات، سیستم صدور گواهی شناسایی تغییرات شما را بررسی می‌کند تا اطمینان حاصل کند که شما کنترل کامل دامنه‌ی خود را دارید.
    - **دریافت گواهی SSL:** پس از تأیید موفقیت اعتبارسنجی DNS، گواهی SSL به شما ارائه خواهد شد تا بر روی سرور شما نصب شود.  
          
        با دنبال کردن دقیق این مراحل و اعمال درست تغییرات در DNS، شما می‌توانید SSL certificate معتبر و ایمنی را بر روی وب‌سایت و یا سرور خود نصب کنید.

حال به بررسی دریافت گواهی SSL برای پاد در کوبرنتیز می پردازیم:

به این منظور ابتدا باید با **cert-manager** در کوبرنتیز آشنا شویم:  
cert-manager یک کنترل کننده و یک مدیریت کننده certificate است که می تواند به صدور گواهینامه از منابع مختلف مانند [Let's Encrypt](https://letsencrypt.org/), [HashiCorp Vault](https://www.vaultproject.io/), [Venafi](https://www.venafi.com/) کمک کند.  
cert-manager اطمینان حاصل می کند که گواهینامه ها معتبر و به روز هستند و سعی می کند گواهی ها را در یک زمان تنظیم شده، قبل از انقضا (expire شدن certificate) تمدید کند  
cert-manager از چندین کامپوننت و همچنین مفاهیم مختلفی تشکیل شده است که برای درک عمیق تر موضوع به توضیح هر یک از آن ها می پردازیم:

- - **Issuer**:  
        Issuers و ClusterIssuers نماینده صادرکنندگان گواهی هستند که قادر به صادر کردن گواهی از طریق درخواست دریافت گواهی از صادر کنندگان هستند، همه گواهی های صادر شده نیاز به یک مرجع صادر کننده گواهی دارند که در وضعیت آماده باش قرار دارد، برای اینکه بتواند درخواست ها را برای دریافت گواهی در مواقع ضروری ارسال کند.  
        یک مثال از یک Issuer از تایپ CA به صورت زیر است:  
        
          
        

  

|   |
|---|
|`apiVersion:` `cert-manager.io/v1`<br><br>`kind:` `Issuer`<br><br>`metadata:`<br><br>  `name:` `ca-issuer`<br><br>  `namespace:` `mesh-system`<br><br>`spec:`<br><br>  `ca:`<br><br>    `secretName:` `ca-key-pair`|

  

این یک صادر کننده ساده است، که گواهی را بر اساس یک Private key امضا می کند، گواهی در ca-key-pair به صورت secret ذخیره می شود. سپس با استفاده از آن Issuer می تواند صحت گواهی های جدید را با استفاده از Public key بررسی کند.  
issuer یک منبع با namespaced است و صدور گواهینامه از یک صادرکننده در namespace دیگر امکان پذیر نیست. این بدان معنی است که شما باید در هر namespace ای که می خواهید گواهینامه دریافت کنید، یک issuer ایجاد کنید.  
همچنین اگر می‌خواهید یک issuer ایجاد کنید که بتواند در namespace های متعدد فرایند دریافت گواهی را انجام دهد، باید یک منبع ClusterIssuer ایجاد کنید. این تقریباً مشابه Issuer Resource است، اما بدون namespace است، بنابراین می توان از آن برای صدور گواهی در همه namespace ها استفاده کرد.

**درخواست های ACME و Challenges**

cert-manager برای درخواست های گواهی از ACME Server پشتیبانی می کند، برای مثال از Let's Encrypt به عنوان ACME Server می تواند استفاده کند. گواهی دریافتی با استفاده از ACME Issuer ، در سراسر اینترنت برای سایر کامپیوتر ها دارای اعتبار است, به منظور موفق شدن فرآیند دریافت گواهی, Cert Manager باید بتواند چلنچ ACME را به منظور اثبات اینکه خود مالک آن دامنه است با موفقیت پشت سر بگذارد، Cert Manager به منظور با موفقیت به پایان رساندن این درخواست از دو resource دیگر، به نام های Order و Challenge استفاده می کند، که به توضیح مختصری در رابطه با آن ها می پردازیم:

**1.Order:  
**یک resource است که توسط ACME Issuer مدیریت می شود، order در واقع به طور خاص یک درخواست گواهی است که به صورت اتوماتیک توسط Cert-Manager ایجاد می شود و به ACME Issuer اشاره می کند.

**2. Challenges:**

یک resource است که توسط ACME Issuer استفاده می شود , و در واقع چرخه دریافت گواهی توسط Challenge طی می شود، Challenge توسط Order ساخت می شود.

- - **چرخه Challenges:  
        **پس از ایجاد شدن یک Challenge، ابتدا در صف پردازش قرار می گیرد. تا زمانی که چالش برای شروع schedule نشده باشد، پردازش آغاز نخواهد شد. این فرآیند زمان‌بندی, از تلاش برای چالش‌های بیش از حد در یک زمان و یا چندین چالش برای یک نام DNS به طور همزمان جلوگیری می‌کند.  
        هنگامی که یک چالش schedule شد، ابتدا با سرور ACME همگام سازی می شود تا وضعیت فعلی آن مشخص شود. اگر چالش از قبل معتبر باشد(گواهی اخذ شده باشد)، وضعیت آن به "معتبر" به روز می شود، و همچنین status.processing = false را به منظور "unschedule" شدن تنظیم می ک  
        اگر چالش در وضعیت "Pendding" باشد، کنترل کننده چالش با استفاده از  configuration solver، یکی از انواع HTTP-01 یا DNS-01 را برای چالش "ارائه" می کند. هنگامی که نوع چالش مشخص شد، status.presented = true تنظیم  می شود.  
          
          
          
        

پس از نصب Securing NGINX-ingress بر روی کلاستر با استفاده helm و همچنین دیپلوی controller آن در سطح کلاستر، یک سرویس متناسب با controller ایجاد می شود که یک آدرس IP پابلیک نیز دریافت می کند.  
  

### TLS Termination at Ingress:  
  

- **برقراری اتصال امن**: هنگامی که یک کلاینت (مانند یک مرورگر وب) درخواستی را به دامنه ارسال می کند، handshake TLS را با Ingress Controller آغاز می کند. Controller گواهی SSL/TLS را به مشتری ارائه می دهد و یک ارتباط امن ایجاد می کند.
- **پایان ارتباط TLS**: کنترل کننده ورودی ترافیک رمزگذاری شده ورودی را با استفاده از کلید خصوصی مرتبط با گواهی رمزگشایی می کند. این فرآیند به عنوان خاتمه TLS شناخته می شود. سپس ترافیک رمزگشایی شده بر اساس قوانین مسیریابی تعریف شده در Ingress به سرویس مناسب در کلاستر Kubernetes هدف ارسال می شود.

### Traffic Routing to Services:

- **فوروارد ترافیک به سمت سرویس**: پس از خاتمه TLS، کنترل کننده درخواست HTTP را بررسی می کند تا سرویس مقصد مورد نظر را بر اساس هدر و مسیر میزبان تعیین کند.
- **مسیریابی داخلی**: کنترل کننده سپس ترافیک رمزگشایی شده را به سرویس Kubernetes مناسب هدایت می کند، که به نوبه خود ترافیک را بر اساس سیاست متعادل سازی بار خود به پاد(های) صحیح هدایت کند.

### Configuration of Issuer or ClusterIssuer:  
  

- پس از نصب Cert-Manager بر روی کلاستر، یک منبع صادرکننده یا ClusterIssuer ایجاد می‌شود تا مشخص کند گواهی‌ها کجا و چگونه به دست می‌آیند. یک Issuer در یک namespace واحد عمل می کند، در حالی که یک ClusterIssuer به صورت سراسری در تمام کلاستر است و می تواند به هر namespace ای سرویس دهد. در زیر نمونه ای از پیکربندی ClusterIssuer برای Let's Encrypt را می بینیم:  
      
    
    |   |
    |---|
    |`apiVersion:` `cert-manager.io/v1`<br><br>`kind:` `ClusterIssuer`<br><br>`metadata:`<br><br>  `name:` `letsencrypt-prod`<br><br>`spec:`<br><br>  `acme:`<br><br>    `email:` `your-email@example.com`<br><br>    `server:` `https``:``//acme-v02.api.letsencrypt.org/directory`<br><br>    `privateKeySecretRef:`<br><br>      `name:` `letsencrypt-prod`<br><br>    `solvers:`<br><br>    `-` `http01``:`<br><br>        `ingress:`<br><br>          `class:` `nginx`|
    
     

          این کانفیگ مشخص می‌کند که Cert-Manager باید از پروتکل ACME با استفاده از Let's Encrypt برای صدور گواهی‌ها استفاده کند.

### Securing an Ingress with cert-manager:  
  

- برای امن کردن ingress، یک ingress resource ایجاد می کنیم تا دارای یک annotation باشد که صادرکننده مورد استفاده را مشخص می‌کند و TLS را فعال می‌کند. مثلا:  
      
    
    |   |
    |---|
    |`apiVersion:` `networking.k8s.io/v1`<br><br>`kind:` `Ingress`<br><br>`metadata:`<br><br>  `name:` `my-ingress`<br><br>  `annotations:`<br><br>    `cert-manager.io/cluster-issuer``:` `"letsencrypt-prod"`<br><br>`spec:`<br><br>  `tls:`<br><br>  `-` `hosts``:`<br><br>    `-` `www.example.com`<br><br>    `secretName:` `example-com-tls`<br><br>  `rules:`<br><br>  `-` `host``:` `www.example.com`<br><br>    `http:`<br><br>      `paths:`<br><br>      `-` `path``:` `/`<br><br>        `pathType:` `Prefix`<br><br>        `backend:`<br><br>          `service:`<br><br>            `name:` `my-service`<br><br>            `port:`<br><br>              `number:` `80`|
    

          این ingress resource  به Cert-Manager دستور می دهد تا از letsencrypt-prod ClusterIssuer برای دریافت گواهی برای [www.example.com](http://www.example.com/) استفاده کند. گواهی و کلید خصوصی مربوط به آن در یک Kubernetes Secret (example-com-tls) ذخیره می شود که ingress controller از آن برای پایان دادن به ارتباط  
          TLS استفاده می کند.

### The HTTP-01 Challenge Process with cert-manager:

- **Challenge Initiation** ![grinning face](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f600 "grinning face") :  هنگامی که Cert-Manager نیاز به اثبات کنترل یک دامنه به سرور ACME (مانند Let's Encrypt) برای دریافت گواهی TLS دارد، از بین چندین نوع چالش (HTTP-01, DNS-01 ) یکی را انتخاب می کند. برای چالش HTTP-01، باید یک توکن خاص در یک URL شناخته شده (http://<domain>/.well-known/acme-challenge/<token>) در دامنه ای که اعتبارسنجی می شود قابل دسترسی باشد.
- **Pod Creation ![slightly smiling face](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f642 "slightly smiling face")  :** یک پاد موقت در کلاستر هدف توسط Cert-Manager ایجاد می شود، این پاد یک وب سرور ساده را ارائه می دهد که برای پاسخگویی با توکن در مسیر مشخص شده توسط سرور ACME کانفیگ شده است. نام و کانفیگ این پاد به صورت داخلی توسط Cert-Manager مدیریت می‌شود تا اطمینان حاصل شود که به درخواست چالش پاسخ صحیح می‌دهد. 
- **Ingress Resource Creation ![smiling face with halo](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f607 "smiling face with halo")  :** همراه با پاد، Cert-Manager همچنین یک ingress resource موقت ایجاد می کند. این Ingress به طور خاص برای هدایت ترافیک برای URL چالش (/.well-known/acme-challenge/<token>) به Pod موقت کانفیگ شده است. این تضمین می‌کند که وقتی سرور ACME سعی می‌کند با دسترسی به URL چالش، توکن را تأیید کند، درخواست به درستی به Pod ارسال می‌شود که پاسخ مورد انتظار را ارائه می‌کند.
- **Verification by ACME Server**: ![smiling face with smiling eyes](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f60a "smiling face with smiling eyes")  : سرور ACME (به عنوان مثال، Let's Encrypt) یک درخواست HTTP به URL چالش می دهد. به دلیل کانفیگ Ingress، این درخواست به Pod موقت هدایت می شود که با توکن صحیح پاسخ می دهد.
- **Certificate Issuance** ![smiling face with heart-eyes](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f60d "smiling face with heart-eyes") : پس از تأیید موفقیت آمیز توکن (اثبات کنترل بر دامنه)، سرور ACME گواهی TLS درخواستی را برای Cert-Manager صادر می کند. سپس Cert-manager این گواهی را در یک Kubernetes Secret ذخیره می کند و آن را برای استفاده توسط Ingress resource مناسب برای ایمن سازی ترافیک HTTPS کانفیگ می کند.
- **Cleanup ![nerd face](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f913 "nerd face")  :**  پس از صدور گواهی، Cert-Manager منبع موقت Pod و Ingress مورد استفاده برای چالش را حذف می‌کند. این پاکسازی تضمین می‌کند که هیچ منبع غیرضروری در کلاستر شما در حال اجرا باقی نمی‌ماند.

ایجاد هر دو منبع Pod و Ingress توسط Cert-Manager در طول فرآیند چالش HTTP-01 یک اتوماسیون هوشمندانه است که کار دریافت و تمدید گواهی‌های TLS را ساده می‌کند. با مدیریت پویا فرآیند تأیید چالش، مدیر گواهی، سربار دستی مدیریت گواهی‌های TLS را حذف می‌کند و ایمن کردن ارتباطات در محیط‌های Kubernetes را آسان‌تر می‌کند.

### The DNS-01 Challenge Process with cert-manager:

چالش DNS-01 یکی از روش‌هایی است که توسط پروتکل مدیریت گواهی خودکار (ACME) برای اثبات مالکیت دامنه هنگام صدور گواهی‌های TLS/SSL استفاده می‌شود. این روش به ویژه زمانی مفید است که نمی‌توانید ترافیک ورودی در پورت HTTP (80) را برای دامنه مورد نظر دریافت کنید، که لازمه چالش HTTP-01 است. همچنین این روش ترجیحی برای به دست آوردن گواهینامه های wildcard است که در ادامه در مورد آن توضیح خواهیم داد. در اینجا نحوه عملکرد چالش DNS-01 در زمینه یک کلاینت ACME مانند Cert-Manager، که صدور و تمدید گواهینامه ها را از Let's Encrypt یا سایر مراجع گواهی (CAs) منطبق با ACME به صورت خودکار انجام می دهد را توضیح می دهیم: 

- **Request a Certificate** ![face with monocle](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f9d0 "face with monocle") :  مدیر یا ابزار اتوماسیون (مانند cert-manager) یک گواهی TLS برای یک دامنه از یک CA سازگار با ACME درخواست می کند. اگر از چالش DNS-01 استفاده کنید، این نشان می‌دهد که CA باید با جستجوی یک رکورد خاص در تنظیمات DNS دامنه، مالکیت دامنه را تأیید کند.
    
- **Receive the Challenge ![grinning face](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f600 "grinning face")**  :  با یک چالش DNS-01، که شامل یک توکن است، پاسخ می دهد. این توکن باید برای ایجاد یک رکورد DNS TXT با نام و مقدار خاص استفاده شود. نام رکورد TXT عموماً با فرمت _acme-challenge.yourdomain.com است و مقدار آن خلاصه ای است که ترکیبی از نشانه و اثر انگشت حساب شما است و تضمین می کند که فقط درخواست مالک دامنه ای که درخواست را آغاز کرده است می تواند با موفقیت انجام شود. 
    
- **Update DNS Records ![winking face](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f609 "winking face")  :**  سپس درخواست کننده (یا Cert-Manager، که از طرف درخواست کننده عمل می کند) رکورد DNS TXT مورد نیاز را در تنظیمات DNS دامنه ایجاد می کند. این فرآیند بسته به محل میزبانی DNS دامنه متفاوت است و ممکن است مدتی طول بکشد تا در اینترنت منتشر شود. ابزارهایی مانند cert-manager می توانند این مرحله را خودکار کنند و با ارائه دهندگان DNS پشتیبانی شده برای ایجاد رکورد DNS لازم به صورت تعاملی ارتباط برقرار کنند.
    
- **Notify the CA ![smiling face with sunglasses](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f60e "smiling face with sunglasses")  :** هنگامی که رکورد DNS TXT در جای خود قرار گرفت و زمان انتشار داشت، درخواست‌کننده به CA اطلاع می‌دهد تا تأیید را ادامه دهد. در سیستم های خودکار مانند cert-manager، این مرحله نیز به صورت خودکار انجام می شود.
    
- **CA Verifies the Challenge ![partying face](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f973 "partying face")  :** نهایتا CA پرس و جو از سیستم DNS برای رکورد TXT در زیر دامنه مشخص شده (acme-challenge.yourdomain.comـ) مالکیت دامنه را تأیید می کند. اگر CA رکورد را پیدا کند و مقدار آن با خلاصه مورد انتظار مطابقت داشته باشد، مالکیت دامنه تأیید شده در نظر گرفته می شود.
    
- **Certificate Issuance ![relieved face](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f60c "relieved face")  :** پس از تأیید موفقیت آمیز، CA گواهی درخواستی را برای درخواست کننده صادر می کند. در یک محیط خودکار، گواهی پس از آن به طور خودکار نصب و برای استفاده کانفیگ می‌شود، اغلب با ایجاد یا به‌روزرسانی یک Kubernetes Secret و  کانفیگ منابع Ingress برای استفاده از گواهی برای ترافیک HTTPS این مورد انجام می شود.
    
- **Cleanup ![beaming face with smiling eyes](https://confluence.hamravesh.ir/plugins/servlet/twitterEmojiRedirector?id=1f601 "beaming face with smiling eyes")  :** پس از صدور گواهی (و به صورت اختیاری، پس از نصب موفقیت آمیز آن)، هرگونه رکورد موقت DNS ایجاد شده برای چالش را می توان حذف کرد. ابزارهای اتوماسیون مانند cert-manager ممکن است فوراً این سوابق را پاک نکنند زیرا وجود آنها در عملکرد یا امنیت دامنه تداخلی ایجاد نمی کند و ممکن است برای تمدید مجدد استفاده شود.
    

چالش DNS-01 به ویژه برای سناریوهایی که کنترل مستقیم ترافیک وب ممکن نیست یا زمانی که در حال تنظیم گواهی برای سرویس‌هایی هستید که مستقیماً در معرض اینترنت نیستند، سودمند است. همچنین برای صدور گواهینامه های wildcard ضروری است، که می تواند هر زیر دامنه دامنه اصلی شما را با یک گواهی واحد ایمن کند.

# **acme-dns**  :

یک سرور DNS ساده شده با یک API HTTP RESTful برای ارائه راهی ساده برای خودکارسازی چالش های ACME DNS است که در دریافت گواهی های wildcard از آن استفاده می کنیم.

چرا؟  
بسیاری از سرورهای DNS یک API برای فعال کردن اتوماسیون برای چالش های ACME DNS ارائه نمی دهند. آنهایی که این کار را می کنند، به کلیدها قدرت زیادی می دهند.

Acme-dns یک API ساده منحصراً برای به‌روزرسانی‌های رکورد TXT ارائه می‌کند به صورت که یک رکورد از نوع CNAME به acme-challenge_  در نهایت اشاره می کند. به این ترتیب، در مواجهه ناخوشایند کلیدهای API، اثرات به رکورد TXT زیر دامنه مورد نظر محدود می شود.

#### **استفاده از acme-dns یک فرآیند سه مرحله ای است :**

- - دریافت اعتبار و زیردامنه منحصر به فرد (درخواست ساده POST به عنوان مثال [https://auth.acme-dns.io/register](https://auth.acme-dns.io/register)):  
        
        |   |
        |---|
        |`curl -s -X POST https:``//auth``.acme-dns.io``/register` `\| python -m json.tool`|
        
          
        با استفاده از دستور بالا باید خروجی مانند زیر دریافت کنیم:  
          
          
        
        |   |
        |---|
        |`{`<br><br>    `"allowfrom"``:` `[``]``,`<br><br>    `"fulldomain"``:` `"3c45f70f-a8b1-4158-af33-7e6e39e810d1.auth.acme-dns.io"``,`<br><br>    `"password"``:` `"rcC6gsH6qvmftIQH_szGJu8owAqB5xRmLiJlHbKn"``,`<br><br>    `"subdomain"``:` `"3c45f70f-a8b1-4158-af33-7e6e39e810d1"``,`<br><br>    `"username"``:` `"f199691d-27c4-4c77-8b7e-6a537e781516"`<br><br>`}`|
        
        همچنین محتوای بالا رو در فایل acme-dns برای تولید secret ذخیره می کنیم.

- - یک رکورد CNAME در Domain Provider خود ایجاد کنید و به زیر دامنه ای که از ثبت نام دریافت کرده اید اشاره کنید.(`acme-challenge.domainiwantcertfor.tld. CNAME a097455b-52cc-4569-90c8-7a4b97c6eba8.auth.example.orgـ`)
    - از Cert-Manager برای برای ارسال مقادیر چالش DNS جدید به سرور acme-dns برای تأیید اعتبار توسط CA استفاده می کنیم.

## **دریافت گواهی Wild Card در هم روش**

برای این منظور با استفاده از ریپوی orgs1 کانفیگ مورد نظر برای acmedns و issuer و wildcard را در دایرکتوری مطابق نمونه های موجود قرار دهید, حال به بررسی کانفیگ های گفته شده می پردازیم:

- **acmedns:**  
    
    **acmedns**
    
    |   |
    |---|
    |`apiVersion:` `v1`<br><br>`kind:` `Secret`<br><br>`metadata:`<br><br>  `name:` `acme-dns`<br><br>  `namespace:` `menew`<br><br>`type:` `Opaque`<br><br>`stringData:`<br><br>  `acme-dns:` `\|`<br><br>    `{`<br><br>      `"domain-name"``:` `{`<br><br>        `"username"``:` `"---------------------------------------"``,`<br><br>        `"password"``:` `"---------------------------------------"``,`<br><br>        `"fulldomain"``:` `"---------------------.auth.acme-dns.io"``,`<br><br>        `"subdomain"``:` `"---------------------------------------"``,`<br><br>        `"allowfrom"``:` `[``]`<br><br>      `}``,`<br><br>      `"domain-name"``:` `{`<br><br>        `"username"``:` `"-----------------------------------------"``,`<br><br>        `"password"``:` `"-----------------------------------------"``,`<br><br>        `"fulldomain"``:` `"-----------------------.auth.acme-dns.io"``,`<br><br>        `"subdomain"``:` `"-----------------------------------------"``,`<br><br>        `"allowfrom"``:` `[``]`<br><br>      `}`<br><br>    `}`|
    
    مطابق با خروجی دستور بالا که برای دریافت اعتبار از acmedns اقدام کردیم و خروجی یک json بود ، مطابق با domain-name مورد نظر خروجی دستور را در آن قرار می دهیم.
- **issuer:  
    **
    
    **issuer**
    
    |   |
    |---|
    |`apiVersion:` `cert-manager.io/v1`<br><br>`kind:` `Issuer`<br><br>`metadata:`<br><br>  `name:` `letsencrypt-prod`<br><br>  `namespace:` `menew`<br><br>`spec:`<br><br>  `acme:`<br><br>    `email:` `admin@hamravesh.com`<br><br>    `preferredChain:` `""`<br><br>    `privateKeySecretRef:`<br><br>      `name:` `letsencrypt-account-key`<br><br>    `server:` `https``:``//acme-v02.api.letsencrypt.org/directory`<br><br>    `solvers:`<br><br>    `-` `dns01``:`<br><br>        `acmeDNS:`<br><br>          `accountSecretRef:`<br><br>            `key:` `acme-dns`<br><br>            `name:` `acme-dns`<br><br>          `host:` `https``:``//auth.acme-dns.io`|
    
    در قسمت issuer اطلاعات مربوط به issuer برای تایید گواهی ssl را وارد می کنیم.
- **wildcard:  
    **
    
    **wildcard**
    
    |   |
    |---|
    |`apiVersion:` `networking.k8s.io/v1`<br><br>`kind:` `Ingress`<br><br>`metadata:`<br><br>  `annotations:`<br><br>    `ingress.kubernetes.io/force-ssl-redirect``:` `"true"`<br><br>    `ingress.kubernetes.io/ssl-redirect``:` `"true"`<br><br>    `cert-manager.io/issuer``:` `letsencrypt-prod`<br><br>  `name:` `wildcard-name`<br><br>  `namespace:` `namespace`<br><br>`spec:`<br><br>  `rules:`<br><br>    `-` `host``:` `"*.example.com"`<br><br>      `http:`<br><br>        `paths:`<br><br>          `-` `backend``:`<br><br>              `service:`<br><br>                `name:` `nginx`<br><br>                `port:`<br><br>                  `name:` `main`<br><br>            `path:` `/`<br><br>            `pathType:` `ImplementationSpecific`<br><br>  `tls:`<br><br>    `-` `hosts``:`<br><br>        `-` `"example.com"`<br><br>        `-` `"*.example.com"`<br><br>      `secretName:` `wildcard-example.com`|
    
    یک منبع از نوع ingress می سازیم که بتوانیم تمام آدرس های * را برای دامنه مورد نظر پوشش بدیم.

در نهایت بعد از اعمال تغییرات و ایجاد فایل های مربوطه با استفاده از argo مجددا کانفیگ را با کوبر sync می کنیم تا تغییرات مورد نظر اعمال شود.

  

## **مشکلات پر تکرار:**

  

- ست نشدن رکورد متناسب مطابق تنظیمات موجود در کنسول
- پرشدن صف Pendding موجود در کلاستر ( به خصوص در کلاستر c14 )
- مشکلات موجود در سمت CDN (روشن بودن Proxy در challenge اولیه HTTP-01 )
- پشتیبانی نشدن از اندروید ورژن های پایین تر توسط letsencrypt بعد از renew شدن certificate
- در اپ هایی که که تعدادی دامنه دارند یکی از مشکلات پر تکرار به این دلیل هست که چون گواهی در لحظه به دلیل یکی بودن ingress برای تمامی دامنه های یک اپ، برای یک اپ صادر می شود و اگر تنها مشکلی در دریافت گواهی برای یک دامنه وجود داشته باشد باعث می شود گواهی برای اپ با مشکل مواجه می شود.
-
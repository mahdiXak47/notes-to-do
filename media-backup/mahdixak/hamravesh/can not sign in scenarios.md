# پشتیبانی مسئله مشکل در ورود به کنسول(can not sign in)

در تمامی این موارد نیاز هست که شخصی که تیکت can not sign in ارسال کرده است
اعتبارسنجی شود. در حال حاضر اعتبار سنجی به این شکل است. اعتبارسنجی کاربر از سمت
تیم ساپورت انجام می‌شود. در صورتی که داده کافی برای اعتبارسنجی وجود نداشت و یا
کیس خاصی رخ داده بود تیکت به سمت تیم قرقی روت خواهد شد.

## نحوه اعتبارسنجی کاربر

1. کاربر رو در بخش [کاربران
   جنگوادمین](https://admin.hamravesh.ir/backstage/admin/accounts/user/) پیدا
   می‌کنیم:
2. در بخش شماره تلفن، شماره تلفن ثبت شده در تیکت رو وارد می‌کنیم و اکشن validate
   phone and national id رو انتخاب می‌کنیم.
3. دکمه Go رو میزنیم و منتظر استعلام می‌مونیم.
![cant-sign-in1.png](/api/vault/uploads/910753604efc44d79a2b19077ef73c3d.png/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc1ODkxODAzLCJpYXQiOjE3NzU4ODgyMDMsImp0aSI6IjFlNjdhM2Y4NDU2NzRmZmI4Mjk3YjNjNDFiZGQwMjczIiwidXNlcl9pZCI6IjEifQ.o2HyIdHOR07l7Pw4yn0poiaXlPijfWJ0nvwwrFj9IrI)

در صورت معتبر بودن شماره‌همراه با کدملی با پیام زیر مشاهده خواهد‌شد
![cant-sign-in2.png](/api/vault/uploads/73732e7020ff4a0882ba91efa895ee1d.png/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc1ODkxODAzLCJpYXQiOjE3NzU4ODgyMDMsImp0aSI6IjFlNjdhM2Y4NDU2NzRmZmI4Mjk3YjNjNDFiZGQwMjczIiwidXNlcl9pZCI6IjEifQ.o2HyIdHOR07l7Pw4yn0poiaXlPijfWJ0nvwwrFj9IrI)

در غیر این صورت ممکن است ارور‌های زیر نمایش داده شود.
![cant-sign-in3.png](/api/vault/uploads/cff15ef3953543dd82345f91893c0b94.png/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc1ODkxODAzLCJpYXQiOjE3NzU4ODgyMDMsImp0aSI6IjFlNjdhM2Y4NDU2NzRmZmI4Mjk3YjNjNDFiZGQwMjczIiwidXNlcl9pZCI6IjEifQ.o2HyIdHOR07l7Pw4yn0poiaXlPijfWJ0nvwwrFj9IrI)

![cant-sign-in4.png](/api/vault/uploads/2ba544d6320144aab6c3252b1ba79194.png/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc1ODkxODAzLCJpYXQiOjE3NzU4ODgyMDMsImp0aSI6IjFlNjdhM2Y4NDU2NzRmZmI4Mjk3YjNjNDFiZGQwMjczIiwidXNlcl9pZCI6IjEifQ.o2HyIdHOR07l7Pw4yn0poiaXlPijfWJ0nvwwrFj9IrI)

در صورت مشاهده هر ارور یا خطای دیگری غیر از موارد گفته شده تیکت رو به همراه
اطلاعات دریافتی به تیم قرقی route کنید.

سناریو‌های مختلف مسئله:

### کاربر پسورد اکانت هم‌روش خود را از دست داده

برای این مورد کاربر رو به راهنمایی می‌کنیم تا در صفحه لاگین از گزینه فراموشی رمز
عبور استفاده کنه.بعد از استفاده از این گزینه کاربر امکان validate کردن خودش رو
هم از طریق sms و هم از طریق email خواهد داشت.

### کاربر درخواست غیرفعال کردن OTP حسابش رو داره(یا حتی نمی‌دونه OTP داره یا نه)

برای این مسئله با کاربر تماس بگیریم و بعد از اعتبارسنجی با تایید کاربر otp اکانت
رو حذف می‌کنیم تا کاربر بعد از لاگین در صورت نیاز مجددا otp برای خودش فعال کنه.

#### نحوه حذف otp کاربر

در [این مسیر](https://admin.hamravesh.ir/backstage/admin/accounts/twofactor/) با
وارد کردن ایمیل کاربر otp مربوطه رو پیدا کرده و بعد از وارد شدن two factor رو
delete می‌کنیم.
![cant-sign-in5.png](/api/vault/uploads/21d831d253134d419bd152e378343a12.png/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc1ODk1ODk1LCJpYXQiOjE3NzU4OTIyOTUsImp0aSI6ImQ3NTU0ZWRmM2RhYjQzYmY4Zjk3MDVjYjk2MDg4ZTAxIiwidXNlcl9pZCI6IjEifQ.rrUitqQ_PyFITumDh7-PrXupalsH39yCqdWKyZEtrbg)

### کاربر ایمیل اشتباهی برای لاگین به حساب‌کاربری خودش وارد کرده(فراموش ایمیل توسط کاربر)

با شماره‌ای که توسط کاربر وارد شده تماس می‌گیریم و اطلاعاتی در خصوص ایمیلی که در
سازمان هم‌روش برای این شماره تلفن ثبت شده سوالاتی می‌پرسیم(مثل حدس اینکه چه
ایمیلی رو وارد کرده یا اینکه نام یا نام‌خانوادگیش در داخل ایمیل هست یا نه) اگر
گفته کاربر با ایمیل هم‌خونی داشت ایمیل رو بهش می‌گیم که با اون ایمیل لاگین و یا
reset password انجام بده

### کاربری که هنگام ثبت‌نام با خطای "شماره تلفن وارد شده در کنسول حساب‌کاربری دارد" مواجه می‌شود

کاربر را ولیدیت می‌کنیم. سپس در صورت تایید اگر مشتری می‌خواست با شماره تلفن ثبت شده در اکانت دیگری استفاده کنه در قسمت django admin -> users شماره تلفن کاربر به همراه کد ملی رو پاک می‌کنیم و تیکت is verified و تیکت تایید شماره تماس و کدملی رو برمی‌داریم 

![cant-sign-in6.png](/api/vault/uploads/dfee96167e3b4b3686ff15cb2d52aa8e.png/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc1ODk1ODk1LCJpYXQiOjE3NzU4OTIyOTUsImp0aSI6ImQ3NTU0ZWRmM2RhYjQzYmY4Zjk3MDVjYjk2MDg4ZTAxIiwidXNlcl9pZCI6IjEifQ.rrUitqQ_PyFITumDh7-PrXupalsH39yCqdWKyZEtrbg)

### وجود اینسیدنتی که باعث شده باشد امکان ورود و ثبت‌نام به کنسول امکان‌پذیر نباشد

تا به حال با این کیس مواجه نشدیم

### کاربری که اتباع خاص هست و کدملی نداره

مورد می رسه دست قرقی. داخل تیم is_national_id_verified رو true می کنیم ولی national_id رو خالی می ذاریم.
در ادامه باید تماس گرفته شه باهاشون و اطلاع داده بشه


### کاربری که شخص حقوقی است و قصد ثبت اطلاعات با استفاده از شناسه‌شرکت و شماره‌تلفن شرکت رو داره

در حال حاضر مکانیزمی برای ولیدیت کردن این موضوع نداریم و به مشتری اطلاع میدیم که فعلا مجبورن با اطلاعات شخصی ولیدیت کنن حساب‌کاربریشون رو

### در صورت کار نکردن captcha کاربر امکان لاگین نخواهد داشت

تا به حال با این سناریو مواجه نشدیم


### کاربر با ایمیل سازمانی یا کاستومی که در لیست بلک‌لیست باشه امکان ثبت‌نام نخواهد داشت(<test@costum.com>)

در صورتی که کاربر ایمیلش رو وارد کنه و بگه که با این ایمیل امکان‌ ثبت‌نام رو نداره تیکت رو به قرقی روت می‌کنیم و می‌پرسیم که آیا اوکیه که این ایمیل بتونه ثبت‌نام کنه در کنسول یا نه؟ اگر اوکی بود به کاربر اطلاع می‌دیم که تست کنه باید اوکی باشه اگر نبود اطلاع میدیم که با این ایمیل نمی‌تونه در کنسول ثبت‌نام کنه و باید از ایمیل دیگری استفاده کنه.
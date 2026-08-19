(function () {
  const STORAGE_KEY = "nour-tech-language";
  const ARABIC = "ar";
  const ENGLISH = "en";
  let activeLanguage = ENGLISH;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const originalPageTitle = document.title;

  // Egyptian Arabic is intentionally conversational rather than formal MSA.
  const arabicText = {
    "Your trusted destination for laptops and graphics cards": "مكانك الموثوق للّابتوبات وكروت الشاشة",
    "Home": "الرئيسية",
    "Laptops": "لابتوبات",
    "GPUs": "كروت شاشة",
    "Graphics Cards": "كروت الشاشة",
    "Contact": "تواصل معانا",
    "Sign Up": "اعمل حساب",
    "Login": "دخول",
    "My account": "حسابي",
    "My orders": "طلباتي",
    "Cart": "السلة",
    "Menu": "القائمة",
    "Search": "دور",
    "Nour Tech": "نور تك",
    "Nour Tech Egypt": "نور تك مصر",
    "Nour Tech price promise": "وعد نور تك بالسعر",
    "THE LOWEST PRICES IN EGYPT.": "أقل أسعار في مصر.",
    "Found the same product for less? Contact us and we’ll match the price.": "لقيت نفس المنتج أرخص عند أي محل؟ كلّمنا وهنساوي السعر.",
    "Shop laptops": "اتفرج على اللابتوبات",
    "Shop graphics cards": "اتفرج على كروت الشاشة",
    "Laptop performance": "أداء اللابتوبات",
    "YOUR NEXT LAPTOP STARTS HERE.": "اللابتوب الجاي بتاعك من هنا.",
    "Powerful laptops for gaming, work, study, and everyday performance.": "لابتوبات قوية للجيمينج والشغل والدراسة والاستخدام اليومي.",
    "Graphics power": "قوة كروت الشاشة",
    "NEXT-GEN GRAPHICS": "كروت شاشة من الجيل الجديد",
    "BUILT TO PERFORM.": "معمولة عشان الأداء.",
    "Discover powerful GPUs for gaming, streaming, editing, and professional creative work.": "اكتشف كروت شاشة قوية للجيمينج والستريمينج والمونتاج والشغل الإبداعي.",
    "Brand-new, sealed products": "منتجات جديدة سيلد",
    "Fresh stock, sealed and ready": "منتجات مقفولة وجاهزة ليك",
    "Best prices": "أحسن أسعار",
    "Competitive value every day": "أسعار منافسة كل يوم",
    "Fast delivery": "توصيل سريع",
    "Quick and secure dispatch": "شحن سريع وآمن",
    "Specialist technical support": "دعم من فريق فني متخصص",
    "Advice from people who know hardware": "ناس فاهمة تساعدك تختار الصح",
    "Portable performance": "أداء قوي معاك في أي مكان",
    "Power your next build": "قوّي التجميعة الجاية",
    "Your computer store in Egypt for laptops and graphics cards": "متجر الكمبيوتر بتاعك في مصر للّابتوبات وكروت الشاشة",
    "Looking for a laptop store in Egypt or ready to buy a GPU? Compare genuine hardware, clear specifications, and prices in EGP before you order.": "بتدور على متجر لابتوبات في مصر أو عايز تشتري كارت شاشة؟ قارن المنتجات الأصلية والمواصفات الواضحة والأسعار بالجنيه قبل ما تطلب.",
    "No laptops or graphics cards matched your search.": "ملقيناش لابتوبات أو كروت شاشة مناسبة لبحثك.",
    "Quick response": "رد سريع",
    "Fast help before and after your order": "مساعدة سريعة قبل وبعد طلبك",
    "Warranty support": "دعم الضمان",
    "Clear product and warranty information": "معلومات واضحة عن المنتج والضمان",
    "Expert guidance": "استشارة من ناس فاهمة",
    "Talk to us before choosing your hardware": "كلّمنا قبل ما تختار جهازك",
    "Laptops and graphics cards backed by detailed specifications and personal support.": "لابتوبات وكروت شاشة بمواصفات واضحة ودعم شخصي.",
    "Performance laptops and graphics cards, backed by clear advice and dependable local support.": "لابتوبات وكروت شاشة أداءها قوي، مع نصيحة واضحة ودعم تقدر تعتمد عليه.",
    "Shop": "تسوق",
    "Support": "مساعدة",
    "Checkout": "إتمام الطلب",
    "Delivery & returns": "التوصيل والاسترجاع",
    "Contact us": "تواصل معانا",
    "Create account": "اعمل حساب",
    "Sales Hotline": "خط المبيعات",
    "WhatsApp": "واتساب",
    "Email": "الإيميل",
    "Address": "العنوان",
    "Cairo - Madinat Nasr": "القاهرة - مدينة نصر",
    "Sun – Thu: 10:00 – 18:00": "الأحد – الخميس: 10:00 – 18:00",
    "Full name": "الاسم بالكامل",
    "Phone / WhatsApp": "الموبايل / واتساب",
    "Username": "اسم المستخدم",
    "Password": "كلمة السر",
    "All rights reserved.": "كل الحقوق محفوظة.",
    "Back to catalog": "ارجع للكتالوج",
    "Catalog Search": "كتالوج المنتجات",
    "Filters": "فلترة",
    "All products": "كل المنتجات",
    "Price range": "مدى السعر",
    "Any budget": "أي ميزانية",
    "Any price": "أي سعر",
    "Brand": "الماركة",
    "Admin": "الإدارة",
    "Nour Tech control center": "مركز إدارة نور تك",
    "Operations Dashboard": "لوحة الإدارة",
    "Publish products, manage pricing, and keep every customer order moving from one clear workspace.": "ضيف منتجات، عدّل الأسعار، وتابع كل طلبات العملاء من مكان واحد واضح.",
    "Brands Live": "الماركات المتاحة",
    "Products Listed": "المنتجات المعروضة",
    "Open COD Orders": "طلبات الدفع عند الاستلام المفتوحة",
    "Admin sections": "أقسام الإدارة",
    "Products & Brands": "المنتجات والماركات",
    "Orders": "الطلبات",
    "Users": "المستخدمين",
    "Catalog": "الكتالوج",
    "Add new listings, manage product details, and keep every brand on file in one place.": "ضيف منتجات جديدة، عدّل تفاصيلها، وخلي كل الماركات منظمة في مكان واحد.",
    "Add Brand": "ضيف ماركة",
    "Brand Name": "اسم الماركة",
    "Brand Overview": "نبذة عن الماركة",
    "Save Brand": "احفظ الماركة",
    "Publish Product Listing": "انشر منتج جديد",
    "Category": "الفئة",
    "Select Category": "اختار الفئة",
    "Laptop": "لابتوب",
    "GPU": "كارت شاشة",
    "Storage": "التخزين",
    "Motherboard": "اللوحة الأم",
    "Monitor": "شاشة",
    "Printer": "طابعة",
    "Desktop": "كمبيوتر مكتبي",
    "Power": "باور سبلاي",
    "Accessory": "إكسسوار",
    "Select Brand": "اختار الماركة",
    "Listing Title": "اسم المنتج",
    "Short Name": "اسم مختصر",
    "Price (EGP)": "السعر (جنيه)",
    "Shown across the storefront, cart, checkout, and order records.": "بيظهر في الموقع والسلة وإتمام الطلب وسجل الطلبات.",
    "Warranty (years)": "الضمان (سنين)",
    "Image Upload": "رفع صور",
    "Upload & Attach Image": "ارفع الصورة وضيفها",
    "Images are resized and converted to WebP before upload. Source files can be up to 25 MB.": "الصور بتتصغّر وبتتحوّل لـ WebP قبل الرفع. حجم الملف الأصلي لحد 25 ميجا.",
    "Image URLs (comma separated or one per line)": "روابط الصور (بفاصلة أو رابط في كل سطر)",
    "Short Description": "وصف مختصر",
    "Icecat Product ID (optional)": "رقم المنتج في Icecat (اختياري)",
    "If provided, specs are fetched from Icecat and merged into this product.": "لو كتبته، المواصفات بتتسحب من Icecat وتتضاف للمنتج.",
    "Manual Specs (optional)": "مواصفات يدوية (اختياري)",
    "Format: `Key: Value`, separated by commas.": "اكتبها بالشكل ده: `اسم المواصفة: القيمة`، وبين كل واحدة والتانية فاصلة.",
    "Publish Listing": "انشر المنتج",
    "Cancel Edit": "إلغاء التعديل",
    "Brands on File": "الماركات المسجلة",
    "Published Products": "المنتجات المنشورة",
    "Listing": "المنتج",
    "Price": "السعر",
    "Recent Orders": "آخر الطلبات",
    "Confirm customer details and move each order through its delivery status.": "راجع بيانات العميل وحدّث حالة كل طلب لحد ما يوصل.",
    "Filter by Status": "فلتر بالحالة",
    "All": "الكل",
    "Pending": "قيد الانتظار",
    "Confirmed": "تم التأكيد",
    "Completed": "مكتمل",
    "Cancelled": "اتلغى",
    "Customers": "العملاء",
    "User Directory": "دليل المستخدمين",
    "Review account activity and order counts. Admin accounts remain protected.": "راجع نشاط الحسابات وعدد الطلبات. حسابات الإدارة بتفضل محمية.",
    "Search Users": "دور على مستخدم",
    "Name": "الاسم",
    "Role": "الصلاحية",
    "No orders to display right now.": "مفيش طلبات تظهر دلوقتي.",
    "Guest checkout": "طلب من غير حساب",
    "Customer notes": "ملاحظات العميل",
    "Update order status": "حدّث حالة الطلب",
    "No brands yet.": "مفيش ماركات مسجلة لسه.",
    "No listings published yet.": "مفيش منتجات منشورة لسه.",
    "No users match your search.": "ملقيناش مستخدمين مناسبين للبحث.",
    "No users found.": "مفيش مستخدمين لسه.",
    "Remove": "امسح",
    "Edit": "تعديل",
    "Clear all": "امسح الكل",
    "Products": "المنتجات",
    "Nothing matched your search.": "ملقيناش حاجة مناسبة لبحثك.",
    "Order summary": "ملخص الطلب",
    "Your hardware": "منتجاتك",
    "Order total": "إجمالي الطلب",
    "Place order": "أكد الطلب",
    "Order received": "طلبك وصلنا",
    "Thanks — we’re processing your order.": "شكراً — بنجهز طلبك دلوقتي.",
    "Order reference": "رقم الطلب",
    "Confirmation email": "إيميل التأكيد",
    "Continue shopping": "كمّل تسوق",
    "Contact our team": "تواصل مع فريقنا",
    "Delivery & Returns": "التوصيل والاسترجاع",
    "Delivery across Egypt": "توصيل لكل مصر",
    "14-day returns": "استرجاع خلال 14 يوم",
    "0–2 business days": "0–2 يوم عمل",
    "Price on request": "السعر عند الطلب",
    "View details": "شوف التفاصيل",
    "Add to cart": "ضيف للسلة",
    "Buy now": "اطلب دلوقتي",
    "Out of stock": "غير متوفر حالياً",
    "Compare the hardware that fits your needs, then narrow the list by brand, budget, and key specs.": "قارن الأجهزة اللي تناسبك، وبعدها فلتر بالمركة والميزانية والمواصفات المهمة.",
    "Product filters": "فلترة المنتجات",
    "Minimum price": "أقل سعر",
    "Maximum price": "أعلى سعر",
    "Your Cart": "السلة بتاعتك",
    "Inventory": "المنتجات",
    "My Orders": "طلباتي",
    "Review the products in your basket, adjust quantities, or remove items you no longer need. Continue to checkout when you are ready to place your order.": "راجع المنتجات في سلتك، وعدّل الكميات أو امسح اللي مش محتاجه. كمّل لإتمام الطلب لما تكون جاهز.",
    "Your cart is empty right now.": "السلة فاضية دلوقتي.",
    "Browse the latest products": "اتفرج على أحدث المنتجات",
    "and add your first build.": "وضيف أول منتج ليك.",
    "Item": "المنتج",
    "Unit price": "سعر القطعة",
    "Qty": "الكمية",
    "Total": "الإجمالي",
    "Remove": "امسح",
    "Clear Cart": "افرغ السلة",
    "Proceed to Checkout": "كمّل لإتمام الطلب",
    "Secure order request": "طلب آمن",
    "Complete your order": "كمّل طلبك",
    "We deliver across Egypt in 0–2 business days. Delivery is EGP 100 in Cairo/Giza and EGP 200 elsewhere. Share your details and we’ll confirm your delivery arrangement and payment within 12 working hours.": "بنوصل لكل مصر خلال 0–2 يوم عمل. التوصيل 100 جنيه في القاهرة والجيزة و200 جنيه لباقي المحافظات. اكتب بياناتك وهنأكد معاك التوصيل والدفع خلال 12 ساعة عمل.",
    "Review": "مراجعة",
    "Delivery": "التوصيل",
    "Confirmed": "تم التأكيد",
    "Your checkout is waiting for products.": "إتمام الطلب مستني تضيف منتجات.",
    "Add an item to your cart, then return here when you’re ready.": "ضيف منتج للسلة وبعدين ارجع هنا لما تكون جاهز.",
    "Browse products": "اتفرج على المنتجات",
    "Delivery details": "بيانات التوصيل",
    "Where should we contact you?": "نتواصل معاك فين؟",
    "Your email receives your order confirmation and a copy of every order detail.": "هيوصلك على الإيميل تأكيد الطلب وكل تفاصيله.",
    "Full name": "الاسم بالكامل",
    "Email address": "الإيميل",
    "Phone / WhatsApp": "التليفون / واتساب",
    "Delivery address": "عنوان التوصيل",
    "Order notes": "ملاحظات الطلب",
    "(optional)": "(اختياري)",
    "No account needed": "مش محتاج تعمل حساب",
    "We only use these details to process your order and send its confirmation.": "بنستخدم البيانات دي بس عشان نجهز طلبك ونبعتلك التأكيد.",
    "By placing your order, you’re requesting a confirmation call from Nour Tech. No online payment is taken at this stage.": "لما بتأكد الطلب، أنت بتطلب من نور تك يكلمك للتأكيد. مفيش دفع أونلاين في المرحلة دي.",
    "All listed products are in stock. Delivery is available anywhere in Egypt in 0–2 business days: EGP 100 in Cairo/Giza, EGP 200 elsewhere.": "كل المنتجات المعروضة متوفرة. بنوصل لأي مكان في مصر خلال 0–2 يوم عمل: 100 جنيه للقاهرة والجيزة و200 جنيه لباقي المحافظات.",
    "Your request is safely with the Nour Tech team. We’ll confirm delivery and payment details within 12 working hours; delivery across Egypt takes 0–2 business days and costs EGP 100 in Cairo/Giza or EGP 200 elsewhere.": "طلبك وصل لفريق نور تك بأمان. هنأكد معاك تفاصيل التوصيل والدفع خلال 12 ساعة عمل؛ والتوصيل لكل مصر بياخد 0–2 يوم عمل وبيكلف 100 جنيه في القاهرة والجيزة أو 200 جنيه لباقي المحافظات.",
    "A confirmation with your order details has been sent to your email.": "بعتنالك تأكيد فيه تفاصيل طلبك على الإيميل.",
    "Clear terms for every laptop and graphics card order.": "كل تفاصيل التوصيل والاسترجاع واضحة لكل طلب لابتوب أو كارت شاشة.",
    "We deliver to customers anywhere in Egypt in": "بنوصل لعملائنا في أي مكان في مصر خلال",
    "business days": "أيام عمل",
    ". Delivery costs": ". تكلفة التوصيل",
    "in Cairo and Giza, and": "في القاهرة والجيزة و",
    "in all other governorates.": "في باقي المحافظات.",
    "Every product listed on Nour Tech is currently in stock. After you place an order, our team confirms your delivery details and final delivery arrangement before dispatch.": "كل منتج معروض على نور تك متوفر حالياً. بعد ما تطلب، فريقنا بيأكد معاك تفاصيل وعنوان التوصيل قبل الشحن.",
    "You can request a return within": "تقدر تطلب استرجاع خلال",
    "of delivery": "من استلام الطلب",
    ". To be eligible, the item must be unused, in its original condition, and returned with its original packaging and included accessories.": ". عشان الاسترجاع يتم، المنتج لازم يكون غير مستخدم وبحالته الأصلية ومعاه العلبة وكل الملحقات.",
    "Returns can be handled in store or by mail. For mail returns, a prepaid return label is included in the package. Contact Nour Tech before sending an item back so our team can confirm the return process. We charge no restocking fee, and eligible refunds are processed within": "الاسترجاع ممكن من الفرع أو بالبريد. لو هترجع بالبريد، هتلاقي بوليصة إرجاع مدفوعة في الشحنة. كلم نور تك قبل ما تبعت المنتج عشان نأكد خطوات الاسترجاع. مفيش رسوم استرجاع، والمبالغ المستحقة بترجع خلال",
    "after we receive the returned product.": "بعد ما يوصلنا المنتج المرتجع.",
    "Sign In": "تسجيل الدخول",
    "Enter your credentials to access the marketplace. Admins can manage catalog and orders, while customers can review their purchases and status updates.": "اكتب بيانات الدخول عشان تدخل حسابك. الأدمن يقدر يدير المنتجات والطلبات، والعميل يقدر يراجع مشترياته وحالة طلباته.",
    "Username": "اسم المستخدم",
    "Password": "كلمة السر",
    "New to Nour Tech?": "أول مرة مع نور تك؟",
    "Create an Account": "اعمل حساب",
    "Create an account": "اعمل حساب",
    "Sign up to track orders, save your details for future purchases, and get faster updates from the Nour Tech team.": "اعمل حساب عشان تتابع طلباتك وتحفظ بياناتك للمشتريات الجاية ويوصلك تحديث أسرع من فريق نور تك.",
    "Full Name": "الاسم بالكامل",
    "Create Account": "اعمل الحساب",
    "Already have an account?": "عندك حساب بالفعل؟",
    "Log in here": "ادخل من هنا",
    "Your Orders": "طلباتك",
    "Track the products you've purchased, see delivery status, and review order history. Sign in to access your orders.": "تابع المنتجات اللي اشتريتها، وشوف حالة التوصيل وسجل طلباتك. ادخل عشان تشوف طلباتك.",
    "Order": "الطلب",
    "Placed": "تاريخ الطلب",
    "Items": "المنتجات",
    "Quantity": "الكمية",
    "Status": "الحالة",
    "Contact Nour Tech": "تواصل مع نور تك",
    "Contact our team for product enquiries, support, and delivery questions.": "كلّم فريقنا لو عندك سؤال عن منتج أو محتاج مساعدة أو عايز تعرف تفاصيل التوصيل.",
    "Support Email": "إيميل الدعم",
    "Showroom Address": "عنوان المعرض",
    "Availability & Delivery": "التوفر والتوصيل",
    "Delivery available anywhere in Egypt": "التوصيل متاح لأي مكان في مصر",
    "Delivery in 0–2 business days • EGP 100 in Cairo/Giza, EGP 200 elsewhere": "التوصيل خلال 0–2 يوم عمل • 100 جنيه للقاهرة والجيزة و200 جنيه لباقي المحافظات",
    "All listed products are in stock": "كل المنتجات المعروضة متوفرة",
    "14-day return window": "استرجاع خلال 14 يوم",
    "Edit Contact Details": "عدّل بيانات التواصل",
    "Only admins can see this form. Updates publish instantly to the contact page.": "الأدمن بس يقدر يشوف الفورم دي. أي تعديل بيظهر فوراً في صفحة التواصل.",
    "Availability Lines (one per row)": "مواعيد التوفر (كل سطر لوحده)",
    "Save Contact Info": "احفظ بيانات التواصل",
    "← Back to Inventory": "→ ارجع للمنتجات",
    "Work, create and play anywhere": "اشتغل وابتكر والعب من أي مكان",
    "Desktop performance starts here": "أداء الكمبيوتر المكتبي يبدأ من هنا",
    "Find your next everyday machine": "اختار جهازك اليومي الجاي",
    "Give your PC the graphics power it deserves": "ادي جهازك قوة الجرافيكس اللي يستحقها",
    "Compare processors, memory, storage and displays.": "قارن المعالجات والرام والتخزين والشاشات.",
    "Explore GPUs for gaming, creation and demanding workloads.": "اتفرج على كروت شاشة للجيمينج والشغل الإبداعي والمهام التقيلة.",
    "View product": "شوف المنتج",
    "Unassigned": "بدون ماركة",
    "Laptop Store Egypt": "متجر لابتوبات في مصر",
    "Buy Graphics Cards in Egypt": "اشتري كروت شاشة في مصر",
    "Laptops & Graphics Cards in Egypt": "لابتوبات وكروت شاشة في مصر",
    "Compare genuine laptops for gaming, work, study, and everyday performance.": "قارن لابتوبات أصلية للجيمينج والشغل والدراسة والاستخدام اليومي.",
    "Compare GPUs for gaming, streaming, editing, and creative work.": "قارن كروت شاشة للجيمينج والستريمينج والمونتاج والشغل الإبداعي.",
    "Compare genuine laptops and graphics cards with clear prices in EGP.": "قارن لابتوبات وكروت شاشة أصلية بأسعار واضحة بالجنيه المصري.",
    "Could not load catalog data.": "مش قادرين نحمّل بيانات المنتجات دلوقتي.",
    "Specifications": "المواصفات",
    "No specifications listed yet.": "مفيش مواصفات مسجلة للمنتج لسه.",
    "Advanced specs": "مواصفات إضافية",
    "Hide advanced specs": "اخفي المواصفات الإضافية",
    "Ready to buy?": "جاهز تشتري؟",
    "All listed products are in stock. We deliver across Egypt in 0–2 business days: EGP 100 in Cairo/Giza and EGP 200 elsewhere. We confirm your delivery details with you before dispatch.": "كل المنتجات المعروضة متوفرة. بنوصل لكل مصر خلال 0–2 يوم عمل: 100 جنيه للقاهرة والجيزة و200 جنيه لباقي المحافظات. بنأكد معاك تفاصيل التوصيل قبل الشحن.",
    "Buy Now": "اطلب دلوقتي",
    "Add to Cart": "ضيف للسلة",
    "View Cart": "شوف السلة",
    "View delivery and 14-day return terms": "شوف شروط التوصيل والاسترجاع خلال 14 يوم",
    "Need multiple units or a custom tweak? Add the product to your cart and leave detailed notes at checkout.": "محتاج أكتر من قطعة أو تعديل خاص؟ ضيف المنتج للسلة واكتب تفاصيلك في ملاحظات الطلب.",
    "No orders yet. Head back to the catalog to reserve your next product.": "مفيش طلبات لسه. ارجع للمنتجات واختار المنتج الجاي.",
    "No longer available": "مش متوفر خلاص",
    "Product removed": "المنتج اتمسح",
    "Product": "المنتج",
    "Category": "الفئة",
    "CPU": "المعالج",
    "RAM": "الرام",
    "Other": "ماركات تانية",
    "Contact for price": "كلّمنا عشان السعر",
    "Secure order request": "طلب آمن",
    "Checkout progress": "خطوات إتمام الطلب",
    "Review": "مراجعة",
    "Delivery": "التوصيل",
    "Confirmed": "تم التأكيد",
    "Order assurances": "ضمانات الطلب",
    "Your order is confirmed. Our team will send your order details to your email shortly.": "طلبك اتأكد. فريقنا هيبعتلك تفاصيل الطلب على الإيميل قريب.",
    "your email address": "الإيميل بتاعك",
    "Local storage isn't available in this browser.": "مش قادرين نستخدم حفظ السلة على المتصفح ده.",
    "Some cart items are no longer available.": "في منتجات في السلة مش متوفرة دلوقتي.",
    "Couldn't load the cart right now—refresh and try again.": "مش قادرين نحمّل السلة دلوقتي. حدّث الصفحة وجرب تاني.",
    "Quantity updated.": "اتحدثت الكمية.",
    "Removed from cart.": "اتمسح من السلة.",
    "Cart cleared.": "السلة اتمسحت.",
    "Some checkout items are no longer available.": "في منتجات من الطلب مش متوفرة دلوقتي.",
    "Couldn't load checkout items—refresh and try again.": "مش قادرين نحمّل منتجات الطلب. حدّث الصفحة وجرب تاني.",
    "Nothing to submit yet.": "مفيش منتجات تتأكد لسه.",
    "Couldn't submit the order—please try again.": "مش قادرين نأكد الطلب دلوقتي. جرب تاني.",
    "No availability details published yet.": "مفيش تفاصيل للتوفر متاحة لسه.",
    "Only admins can update contact info.": "الأدمن بس يقدر يعدّل بيانات التواصل.",
    "Saving contact info…": "بنحفظ بيانات التواصل…",
    "Contact details updated.": "اتحدثت بيانات التواصل.",
    "Please sign in as an admin to save these changes.": "سجّل دخول كأدمن عشان تحفظ التعديلات دي.",
    "Couldn't update contact info right now.": "مش قادرين نحدّث بيانات التواصل دلوقتي.",
    "Contact info isn't loading right now.": "بيانات التواصل مش بتتحمّل دلوقتي.",
    "Couldn't load contact info.": "مش قادرين نحمّل بيانات التواصل.",
    "Creating your account…": "بنعمل حسابك…",
    "Signup failed.": "مش قادرين نعمل الحساب.",
    "Network error while creating your account. Please try again.": "في مشكلة في الاتصال وإحنا بنعمل الحساب. جرب تاني.",
    "Signing in…": "بنسجّل دخولك…",
    "Login failed.": "تسجيل الدخول ما نجحش.",
    "Network error while signing in. Please try again.": "في مشكلة في الاتصال وإحنا بنسجّل دخولك. جرب تاني.",
    "Clear terms for every laptop and graphics card order.": "كل شروط التوصيل والاسترجاع واضحة لكل طلب لابتوب أو كارت شاشة.",
    "We deliver to customers anywhere in Egypt in": "بنوصل لعملائنا في أي مكان في مصر خلال",
    "business days": "أيام عمل",
    ". Delivery costs": ". تكلفة التوصيل",
    "in Cairo and Giza, and": "في القاهرة والجيزة و",
    "in all other governorates.": "في باقي المحافظات.",
    "Every product listed on Nour Tech is currently in stock. After you place an order, our team confirms your delivery details and final delivery arrangement before dispatch.": "كل منتج معروض على نور تك متوفر حالياً. بعد ما تطلب، فريقنا بيأكد معاك تفاصيل وعنوان التوصيل قبل الشحن.",
    "You can request a return within": "تقدر تطلب استرجاع خلال",
    "14 days of delivery": "14 يوم من استلام الطلب",
    ". To be eligible, the item must be unused, in its original condition, and returned with its original packaging and included accessories.": ". عشان الاسترجاع يتم، المنتج لازم يكون غير مستخدم وبحالته الأصلية ومعاه العلبة وكل الملحقات.",
    "Returns can be handled in store or by mail. For mail returns, a prepaid return label is included in the package. Contact Nour Tech before sending an item back so our team can confirm the return process. We charge no restocking fee, and eligible refunds are processed within": "الاسترجاع ممكن من الفرع أو بالبريد. لو هترجع بالبريد، هتلاقي بوليصة إرجاع مدفوعة في الشحنة. كلم نور تك قبل ما تبعت المنتج عشان نأكد خطوات الاسترجاع. مفيش رسوم استرجاع، والمبالغ المستحقة بترجع خلال",
    "1 day": "يوم واحد",
    "after we receive the returned product.": "بعد ما يوصلنا المنتج المرتجع.",
    "Product images": "صور المنتج",
    "Previous image": "الصورة اللي قبلها",
    "Next image": "الصورة اللي بعدها",
    "Model": "الموديل",
    "Processor": "المعالج",
    "Graphics": "كارت الشاشة",
    "Graphics Processor": "معالج الجرافيكس",
    "Memory": "الرام",
    "Memory Type": "نوع الرام",
    "Memory Bus": "ناقل الذاكرة",
    "Video Memory": "ذاكرة كارت الشاشة",
    "Storage": "التخزين",
    "Storage Type": "نوع التخزين",
    "Drive Type": "نوع القرص",
    "Drive Size": "مقاس القرص",
    "Display": "الشاشة",
    "Display Size": "مقاس الشاشة",
    "Display Resolution": "دقة الشاشة",
    "Display Type": "نوع الشاشة",
    "Operating System": "نظام التشغيل",
    "Battery": "البطارية",
    "Weight": "الوزن",
    "Dimensions": "الأبعاد",
    "Warranty": "الضمان",
    "Interface": "واجهة التوصيل",
    "Power": "الطاقة",
    "Capacity": "السعة",
    "Speed": "السرعة",
    "Resolution": "الدقة",
    "Panel Type": "نوع البانل",
    "Refresh Rate": "معدل التحديث",
    "Response Time": "زمن الاستجابة",
    "Ports": "المداخل",
    "Cores": "الأنوية",
    "Threads": "الثريدات",
    "Base Frequency": "التردد الأساسي",
    "Boost Frequency": "تردد البوست",
    "Socket": "السوكت",
    "Cache": "الكاش",
    "Chipset": "الشيبست",
    "Memory Slots": "أماكن الرام",
    "Max Memory": "أقصى رام",
    "Form Factor": "الحجم",
    "Networking": "الشبكات",
    "Read Speed": "سرعة القراءة",
    "Write Speed": "سرعة الكتابة",
    "Connectivity": "التوصيل",
    "Cooling": "التبريد",
  };

  const arabicAttributes = {
    "What are you looking for?": "بتدور على إيه؟",
    "Search products": "دور على منتجات",
    "Toggle menu": "افتح القائمة",
    "Search": "دور",
    "Name as it appears on the invoice": "الاسم زي ما هيظهر في الفاتورة",
    "City, district, street, building, and apartment": "المحافظة، المنطقة، الشارع، العمارة، والشقة",
    "Access instructions, preferred delivery slot, or extra details": "تعليمات الوصول أو ميعاد توصيل مناسب أو أي تفاصيل إضافية",
    "Your full name": "اسمك بالكامل",
    "At least 6 characters": "6 حروف على الأقل",
    "you@example.com": "you@example.com",
    "+20 10 0000 0000": "+20 10 0000 0000",
    "username": "اسم المستخدم",
    "Product images": "صور المنتج",
    "Previous image": "الصورة اللي قبلها",
    "Next image": "الصورة اللي بعدها",
    "Checkout progress": "خطوات إتمام الطلب",
    "Order assurances": "ضمانات الطلب",
    "Nour Tech home": "الصفحة الرئيسية لنور تك",
  };

  const arabicPageTitles = {
    "/": "نور تك مصر | لابتوبات وكروت شاشة",
    "/index.html": "نور تك مصر | لابتوبات وكروت شاشة",
    "/category.html": "نور تك | لابتوبات وكروت شاشة في مصر",
    "/laptop.html": "تفاصيل المنتج | نور تك مصر",
    "/checkout.html": "إتمام الطلب | نور تك مصر",
    "/cart.html": "السلة | نور تك مصر",
    "/contact.html": "تواصل مع نور تك",
    "/shipping-returns.html": "التوصيل والاسترجاع | نور تك مصر",
    "/login.html": "دخول | نور تك",
    "/signup.html": "اعمل حساب | نور تك",
    "/account.html": "حسابي | نور تك",
    "/admin.html": "إدارة نور تك",
  };

  function translateTextNode(node) {
    if (node.parentElement?.closest("script, style, textarea, [data-i18n-ignore]")) return;
    const source = originalText.get(node) || node.nodeValue;
    if (!originalText.has(node)) originalText.set(node, source);
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    const key = source.trim().replace(/\s+/g, " ");
    let replacement = activeLanguage === ARABIC ? arabicText[key] : undefined;
    if (activeLanguage === ARABIC && !replacement) {
      const allProducts = key.match(/^View all (\d+)$/i);
      const productCount = key.match(/^(\d+) products?$/i);
      const activeFilters = key.match(/^(\d+) active$/i);
      const filterSummary = key.match(/^(\d+) filters? applied$/i);
      const productBadge = key.match(/^(.*?)\s*•\s*(Laptops|GPUs|Products)$/i);
      const egpPrice = key.match(/^EGP\s*([\d,]+)$/i);
      const egpRange = key.match(/^EGP\s*([\d,]+)\s*–\s*EGP\s*([\d,]+)$/i);
      const priceQuantity = key.match(/^(\d+)\s*×\s*EGP\s*([\d,]+)$/i);
      const productHint = key.match(/^(Brand|Category|CPU|RAM):\s*(.+)$/i);
      const searchContext = key.match(/^Search:\s*["“](.+)["”]$/i);
      if (allProducts) replacement = `شوف الكل (${allProducts[1]})`;
      else if (productCount) replacement = `${productCount[1]} منتج`;
      else if (activeFilters) replacement = `${activeFilters[1]} فلتر شغال`;
      else if (filterSummary) replacement = `${filterSummary[1]} فلتر متطبق`;
      else if (productBadge) {
        const type = productBadge[2].toLowerCase();
        replacement = `${productBadge[1]} • ${type === "laptops" ? "لابتوبات" : type === "gpus" ? "كروت شاشة" : "منتجات"}`;
      }
      else if (egpPrice) replacement = `${egpPrice[1]} جنيه`;
      else if (egpRange) replacement = `${egpRange[1]} جنيه – ${egpRange[2]} جنيه`;
      else if (priceQuantity) replacement = `${priceQuantity[1]} × ${priceQuantity[2]} جنيه`;
      else if (productHint) {
        const label = productHint[1].toLowerCase();
        replacement = `${label === "brand" ? "الماركة" : label === "category" ? "الفئة" : label === "cpu" ? "المعالج" : "الرام"}: ${productHint[2]}`;
      }
      else if (searchContext) replacement = `بحث: “${searchContext[1]}”`;
    }
    const nextValue = replacement ? `${leading}${replacement}${trailing}` : source;
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  }

  function translateTree(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
  }

  function translateAttributes() {
    document.querySelectorAll("[placeholder], [aria-label], [title]").forEach((element) => {
      ["placeholder", "aria-label", "title"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        const attributes = originalAttributes.get(element) || {};
        if (!Object.hasOwn(attributes, attribute)) attributes[attribute] = value;
        originalAttributes.set(element, attributes);
        const original = attributes[attribute];
        element.setAttribute(attribute, activeLanguage === ARABIC ? arabicAttributes[original] || original : original);
      });
    });
  }

  function ensureLanguageToggle() {
    document.querySelectorAll(".store-header-actions").forEach((actions) => {
      if (actions.querySelector("[data-language-toggle]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "language-toggle";
      button.dataset.languageToggle = "true";
      button.dataset.i18nIgnore = "true";
      button.addEventListener("click", () => applyLanguage(activeLanguage === ARABIC ? ENGLISH : ARABIC));
      actions.insertBefore(button, actions.querySelector(".nav-toggle"));
    });
    document.querySelectorAll("[data-language-toggle]").forEach((button) => {
      const switchingTo = activeLanguage === ARABIC ? "English" : "Egyptian Arabic";
      button.textContent = activeLanguage === ARABIC ? "EN" : "عربي";
      button.setAttribute("aria-label", `Switch to ${switchingTo}`);
      button.title = `Switch to ${switchingTo}`;
    });
  }

  function updatePageLanguage() {
    const root = document.documentElement;
    const isArabic = activeLanguage === ARABIC;
    root.lang = isArabic ? "ar-EG" : "en";
    root.dir = isArabic ? "rtl" : "ltr";
    document.body.classList.toggle("is-egyptian-arabic", isArabic);
    document.title = isArabic
      ? arabicPageTitles[window.location.pathname] || "نور تك مصر"
      : originalPageTitle;
  }

  function applyLanguage(language) {
    activeLanguage = language === ARABIC ? ARABIC : ENGLISH;
    try { localStorage.setItem(STORAGE_KEY, activeLanguage); } catch (error) { /* Storage can be disabled. */ }
    updatePageLanguage();
    translateTree(document.body);
    translateAttributes();
    ensureLanguageToggle();
    document.dispatchEvent(new CustomEvent("nour:languagechange", { detail: { language: activeLanguage } }));
  }

  function initialLanguage() {
    const queryLanguage = new URLSearchParams(window.location.search).get("lang");
    if (queryLanguage === ARABIC || queryLanguage === ENGLISH) return queryLanguage;
    try { return localStorage.getItem(STORAGE_KEY) === ARABIC ? ARABIC : ENGLISH; } catch (error) { return ENGLISH; }
  }

  function initialise() {
    applyLanguage(initialLanguage());
    const titleElement = document.querySelector("title");
    if (titleElement) {
      new MutationObserver(() => {
        if (activeLanguage !== ARABIC) return;
        const translatedTitle = arabicPageTitles[window.location.pathname] || "نور تك مصر";
        if (document.title !== translatedTitle) document.title = translatedTitle;
      }).observe(titleElement, { childList: true, characterData: true, subtree: true });
    }
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
          if (node.nodeType === Node.ELEMENT_NODE) {
            translateTree(node);
            translateAttributes();
            ensureLanguageToggle();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.NourLanguage = { set: applyLanguage, get: () => activeLanguage };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();

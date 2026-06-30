#BOOK LEVELS :

KID = "kid"
MIDDLE_GRADE = "middle_grade"
TEEN = "teen"
YOUNG_ADULT = "young_adult"
ADULT = "adult"

LEVEL_CHOICES = (
    (KID, "Kid"),
    (MIDDLE_GRADE, "Middle Grade"),
    (TEEN, "Teen"),
    (YOUNG_ADULT, "Young Adult"),
    (ADULT, "Adult"),
)



#BOOK LANGUAGES :

ENGLISH = "english"
SPANISH = "spanish"
FARSI = "farsi"
FRENCH = "french"

LANGUAGE_CHOICES = (
    (ENGLISH, "English"),
    (SPANISH, "Spanish"),
    (FARSI, "Farsi"),
    (FRENCH, "French"),
)



#BOOK CHOICES :

ADVENTURE = "adventure"
FANTASY = "fantasy"
SCIENCE = "science"
MYSTERY = "mystery"
ROMANCE = "romance"
HORROR = "horror"
COMEDY = "comedy"
HISTORICAL = "historical"
BIOGRAPHY = "biography"
SELF_HELP = "self_help"
EDUCATIONAL = "educational"
BUSINESS = "business"
RELIGION = "religion"

GENRE_CHOICES = (
    (ADVENTURE, "Adventure"),
    (FANTASY, "Fantasy"),
    (SCIENCE, "Science"),
    (MYSTERY, "Mystery"),
    (ROMANCE, "Romance"),
    (HORROR, "Horror"),
    (COMEDY, "Comedy"),
    (HISTORICAL, "Historical"),
    (BIOGRAPHY, "Biography"),
    (SELF_HELP, "Self Help"),
    (EDUCATIONAL, "Educational"),
    (BUSINESS, "Business"),
    (RELIGION, "Religion"),
)



#PAYMENT WAY :

PREMIUM = "premium"
CASH = "cash"
PREMUIM_CASH = "premium and cash"

ACCESS_TYPE_CHOICES = (
    (PREMIUM, "Premium"),
    (CASH, "Cash"),
    (PREMUIM_CASH, "Premium and Cash"),
)



#ONLINE BOOK FORMAT :
PDF = "pdf"
EPUB = "epub"
DOCX = "docx"
TXT = "txt"

FORMAT_CHOICES = (
    (PDF, "PDF"),
    (TXT, "txt"),
    (EPUB, "EPUB"),
    (DOCX, "DocX"),
)

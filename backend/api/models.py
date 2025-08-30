from django.contrib.auth.models import AbstractUser,Permission, Group
from django.db import models

class Personnel(AbstractUser):
    badge_number = models.CharField(max_length=6, unique=True, null=True, blank=True)
    id_image = models.ImageField(upload_to='ids/', null=True, blank=True)
    is_admin = models.BooleanField(default=False)  # ⬅ Add this

    # Override these fields to fix the conflict
    groups = models.ManyToManyField(
        Group,
        related_name='personnel_groups',  # ✅ no conflict
        blank=True
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name='personnel_permissions',  # ✅ no conflict
        blank=True
    )

    def __str__(self):
        return self.username
    

    
OCCUPATION_CHOICES = [
    ("Housewife", "Housewife"),
    ("Employed", "Employed"),
    ("Self-Employed", "Self-Employed"),
    ("OFW", "OFW"),
]

class PersonnelProfile(models.Model):
    # Basic
    id_image = models.ImageField(upload_to='ids/', null=True, blank=True)
    first_name = models.CharField(max_length=150)
    middle_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150)
    suffix = models.CharField(max_length=50, blank=True)
    officer_id = models.CharField(max_length=100, unique=True)  # badge number
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)

    # Academic / other
    department = models.CharField(max_length=150, blank=True)
    section = models.CharField(max_length=150, blank=True)
    sex = models.CharField(max_length=50, blank=True)
    gender = models.CharField(max_length=50, blank=True)
    height = models.CharField(max_length=50, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=255, blank=True)
    officer_type = models.CharField(max_length=100, blank=True)
    regular_officer = models.CharField(max_length=100, blank=True)
    civil_status = models.CharField(max_length=50, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    religion = models.CharField(max_length=100, blank=True)

    # Special categories
    lifelong_learner = models.BooleanField(default=False)
    indigenous = models.BooleanField(default=False)

    # Addresses
    residential_address = models.TextField(blank=True)
    residential_region = models.CharField(max_length=100, blank=True)
    residential_province = models.CharField(max_length=100, blank=True)
    residential_municipality = models.CharField(max_length=100, blank=True)
    residential_barangay = models.CharField(max_length=100, blank=True)

    permanent_address = models.TextField(blank=True)
    permanent_region = models.CharField(max_length=100, blank=True)
    permanent_province = models.CharField(max_length=100, blank=True)
    permanent_municipality = models.CharField(max_length=100, blank=True)
    permanent_barangay = models.CharField(max_length=100, blank=True)

    # Profile image
    profile_image = models.ImageField(upload_to="profiles/", null=True, blank=True)

    # Father's background
    father_first_name = models.CharField(max_length=150, blank=True)
    father_middle_name = models.CharField(max_length=150, blank=True)
    father_last_name = models.CharField(max_length=150, blank=True)
    father_occupation = models.CharField(max_length=50, choices=OCCUPATION_CHOICES, blank=True)
    father_dob = models.DateField(null=True, blank=True)
    father_contact = models.CharField(max_length=50, blank=True)
    father_region = models.CharField(max_length=100, blank=True)
    father_province = models.CharField(max_length=100, blank=True)
    father_municipality = models.CharField(max_length=100, blank=True)
    father_barangay = models.CharField(max_length=100, blank=True)

    # Mother's background
    mother_first_name = models.CharField(max_length=150, blank=True)
    mother_middle_name = models.CharField(max_length=150, blank=True)
    mother_last_name = models.CharField(max_length=150, blank=True)
    mother_occupation = models.CharField(max_length=50, choices=OCCUPATION_CHOICES, blank=True)
    mother_dob = models.DateField(null=True, blank=True)
    mother_contact = models.CharField(max_length=50, blank=True)
    mother_region = models.CharField(max_length=100, blank=True)
    mother_province = models.CharField(max_length=100, blank=True)
    mother_municipality = models.CharField(max_length=100, blank=True)
    mother_barangay = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_archived = models.BooleanField(default=False)  # ⬅ for archive status

    def __str__(self):
        return f"{self.officer_id} - {self.first_name} {self.last_name}"
    

class Region(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name
    

 ### ###  #####crime report model##########

CRIME_TYPE_CHOICES = [
    ("Theft", "Theft"), ("Robbery", "Robbery"), ("Assault", "Assault"),
    ("Homicide", "Homicide"), ("Illegal Fishing", "Illegal Fishing"),
    ("Smuggling", "Smuggling"), ("Drugs", "Drugs"),
    ("Vandalism", "Vandalism"), ("Fraud", "Fraud"), ("Others", "Others"),
]

def victim_upload_to(instance, filename):
    # folder by PK once saved
    return f"victims/{instance.pk or 'new'}/{filename}"

def suspect_upload_to(instance, filename):
    return f"suspects/{instance.pk or 'new'}/{filename}"


class CrimeReport(models.Model):


    STATUS_CHOICES = [
        ("Ongoing", "Ongoing"),
        ("Solved", "Solved"),
        ("Unsolved", "Unsolved"),
    ]

    crime_type   = models.CharField(max_length=100, blank=True, default="", choices=CRIME_TYPE_CHOICES)
    description  = models.TextField(blank=True, default="")
    happened_at  = models.DateField(null=True, blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Ongoing")  # 👈 added
    # Case meta
    crime_type   = models.CharField(max_length=100, blank=True, default="", choices=CRIME_TYPE_CHOICES)
    description  = models.TextField(blank=True, default="")
    happened_at  = models.DateField(null=True, blank=True)

    # Victim (kept inside CrimeReport)
    v_first_name  = models.CharField(max_length=120, blank=True, default="")
    v_middle_name = models.CharField(max_length=120, blank=True, default="")
    v_last_name   = models.CharField(max_length=120, blank=True, default="")
    v_age         = models.CharField(max_length=10,  blank=True, default="")

    v_address            = models.CharField(max_length=255, blank=True, default="")
    v_region             = models.CharField(max_length=120, blank=True, default="")
    v_province           = models.CharField(max_length=120, blank=True, default="")
    v_city_municipality  = models.CharField(max_length=120, blank=True, default="")
    v_city_mun_kind      = models.CharField(max_length=30,  blank=True, default="")
    v_barangay           = models.CharField(max_length=120, blank=True, default="")
    v_region_code        = models.CharField(max_length=20,  blank=True, default="")
    v_province_code      = models.CharField(max_length=20,  blank=True, default="")
    v_city_mun_code      = models.CharField(max_length=20,  blank=True, default="")
    v_barangay_code      = models.CharField(max_length=20,  blank=True, default="")

    v_photo = models.ImageField(upload_to=victim_upload_to, null=True, blank=True)

    # Incident location (for the case)
    loc_address           = models.CharField(max_length=255, blank=True, default="")
    loc_region            = models.CharField(max_length=120, blank=True, default="")
    loc_province          = models.CharField(max_length=120, blank=True, default="")
    loc_city_municipality = models.CharField(max_length=120, blank=True, default="")
    loc_city_mun_kind     = models.CharField(max_length=30,  blank=True, default="")
    loc_barangay          = models.CharField(max_length=120, blank=True, default="")
    loc_region_code       = models.CharField(max_length=20,  blank=True, default="")
    loc_province_code     = models.CharField(max_length=20,  blank=True, default="")
    loc_city_mun_code     = models.CharField(max_length=20,  blank=True, default="")
    loc_barangay_code     = models.CharField(max_length=20,  blank=True, default="")

    latitude   = models.CharField(max_length=50, blank=True, default="")
    longitude  = models.CharField(max_length=50, blank=True, default="")
    loc_kind   = models.CharField(max_length=20,  blank=True, default="")     # marine|coastal|inland|unknown
    loc_waterbody = models.CharField(max_length=120, blank=True, default="")

    # Admin meta
    is_archived = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def victim_full_name(self):
        return " ".join(filter(None, [self.v_first_name, self.v_middle_name, self.v_last_name]))

    def __str__(self):
        return f"{self.crime_type or 'Incident'} - {self.victim_full_name or 'Unknown victim'}"


class Suspect(models.Model):
    """Separate CRUD: many suspects per crime report."""
    crime_report = models.ForeignKey(CrimeReport, on_delete=models.CASCADE, related_name="suspects")

    # Suspect identity
    s_first_name  = models.CharField(max_length=120, blank=True, default="")
    s_middle_name = models.CharField(max_length=120, blank=True, default="")
    s_last_name   = models.CharField(max_length=120, blank=True, default="")
    s_age         = models.CharField(max_length=10,  blank=True, default="")
    s_crime_type  = models.CharField(max_length=100, blank=True, default="")

    # Suspect address
    s_address            = models.CharField(max_length=255, blank=True, default="")
    s_region             = models.CharField(max_length=120, blank=True, default="")
    s_province           = models.CharField(max_length=120, blank=True, default="")
    s_city_municipality  = models.CharField(max_length=120, blank=True, default="")
    s_city_mun_kind      = models.CharField(max_length=30,  blank=True, default="")
    s_barangay           = models.CharField(max_length=120, blank=True, default="")
    s_region_code        = models.CharField(max_length=20,  blank=True, default="")
    s_province_code      = models.CharField(max_length=20,  blank=True, default="")
    s_city_mun_code      = models.CharField(max_length=20,  blank=True, default="")
    s_barangay_code      = models.CharField(max_length=20,  blank=True, default="")

    s_photo = models.ImageField(upload_to=suspect_upload_to, null=True, blank=True)

    # Crime Location (needed by your Suspect form)
    loc_address           = models.CharField(max_length=255, blank=True, default="")
    loc_region            = models.CharField(max_length=120, blank=True, default="")
    loc_province          = models.CharField(max_length=120, blank=True, default="")
    loc_city_municipality = models.CharField(max_length=120, blank=True, default="")
    loc_city_mun_kind     = models.CharField(max_length=30,  blank=True, default="")
    loc_barangay          = models.CharField(max_length=120, blank=True, default="")
    loc_region_code       = models.CharField(max_length=20,  blank=True, default="")
    loc_province_code     = models.CharField(max_length=20,  blank=True, default="")
    loc_city_mun_code     = models.CharField(max_length=20,  blank=True, default="")
    loc_barangay_code     = models.CharField(max_length=20,  blank=True, default="")

    latitude   = models.CharField(max_length=50, blank=True, default="")
    longitude  = models.CharField(max_length=50, blank=True, default="")
    loc_kind   = models.CharField(max_length=20,  blank=True, default="")     # marine|coastal|inland|unknown
    loc_waterbody = models.CharField(max_length=120, blank=True, default="")

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def suspect_full_name(self):
        return " ".join(filter(None, [self.s_first_name, self.s_middle_name, self.s_last_name]))

    def __str__(self):
        return f"{self.suspect_full_name or 'Suspect'} in case #{self.crime_report_id}"
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Personnel,
    PersonnelProfile,
    Region,
    CrimeReport,
    Suspect,
)

# -----------------------------
# Auth / Users
# -----------------------------
class UserRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Personnel
        fields = ["username", "email", "password", "badge_number", "id_image"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_username(self, value):
        if Personnel.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def create(self, validated_data):
        user = Personnel.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email"),
            password=validated_data["password"],
            badge_number=validated_data.get("badge_number"),
            id_image=validated_data.get("id_image"),
        )
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_admin"] = user.is_admin
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["username"] = self.user.username
        data["is_admin"] = self.user.is_admin
        return data


class UserTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.is_admin:
            raise serializers.ValidationError(
                "Admin accounts are not allowed to login here."
            )
        data["is_admin"] = self.user.is_admin
        return data


class AdminTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_admin:
            raise serializers.ValidationError("Only admin accounts can login here.")
        data["is_admin"] = self.user.is_admin
        return data


# -----------------------------
# Profiles / Reference
# -----------------------------
class PersonnelProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonnelProfile
        fields = "__all__"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        for key in ["profile_image"]:
            if data.get(key) and request and not str(data[key]).startswith("http"):
                data[key] = request.build_absolute_uri(data[key])
        return data


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["code", "name"]


# -----------------------------
# Crime Report (Victim-kept)
# -----------------------------
class CrimeReportMiniSerializer(serializers.ModelSerializer):
    victim_full_name = serializers.CharField(read_only=True)

    class Meta:
        model = CrimeReport
        fields = ["id", "crime_type", "happened_at", "victim_full_name"]


class CrimeReportSerializer(serializers.ModelSerializer):
    v_photo_url = serializers.SerializerMethodField()
    # Optional: summary of suspects (read-only)
    suspects = serializers.SerializerMethodField()

    class Meta:
        model = CrimeReport
        fields = "__all__"
        read_only_fields = [
            "created_at",
            "updated_at",
            "is_archived",
            "v_photo_url",
            "suspects",
        ]

    def get_v_photo_url(self, obj):
        request = self.context.get("request")
        if obj.v_photo and hasattr(obj.v_photo, "url"):
            return (
                request.build_absolute_uri(obj.v_photo.url)
                if request
                else obj.v_photo.url
            )
        return ""

    def get_suspects(self, obj):
        return [
            {
                "id": s.id,
                "name": " ".join(
                    filter(None, [s.s_first_name, s.s_middle_name, s.s_last_name])
                ),
                "s_crime_type": s.s_crime_type,
            }
            for s in obj.suspects.all()
        ]


# -----------------------------
# Suspects (separate CRUD)
# -----------------------------
class SuspectSerializer(serializers.ModelSerializer):
    s_photo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Suspect
        fields = [
            "id",
            "crime_report",
            # identity
            "s_first_name",
            "s_middle_name",
            "s_last_name",
            "s_age",
            "s_crime_type",
            # address
            "s_address",
            "s_region",
            "s_province",
            "s_city_municipality",
            "s_city_mun_kind",
            "s_barangay",
            "s_region_code",
            "s_province_code",
            "s_city_mun_code",
            "s_barangay_code",
            # photo
            "s_photo",
            "s_photo_url",
            # crime location for suspect form
            "loc_address",
            "loc_region",
            "loc_province",
            "loc_city_municipality",
            "loc_city_mun_kind",
            "loc_barangay",
            "loc_region_code",
            "loc_province_code",
            "loc_city_mun_code",
            "loc_barangay_code",
            "latitude",
            "longitude",
            "loc_kind",
            "loc_waterbody",
            # meta
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_s_photo_url(self, obj):
        request = self.context.get("request")
        if obj.s_photo and hasattr(obj.s_photo, "url"):
            return (
                request.build_absolute_uri(obj.s_photo.url)
                if request
                else obj.s_photo.url
            )
        return ""

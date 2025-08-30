from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model,authenticate
from .serializers import UserRegistrationSerializer  # You’ll create this
from rest_framework.parsers import MultiPartParser, FormParser

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import CustomTokenObtainPairSerializer

from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import UserTokenObtainPairSerializer, AdminTokenObtainPairSerializer


from rest_framework import generics
from .models import Region
from .serializers import RegionSerializer


####profile information#############
from rest_framework.decorators import action
from rest_framework import viewsets,status
from .models import PersonnelProfile
from .serializers import PersonnelProfileSerializer

from rest_framework.filters import OrderingFilter


from django.http import JsonResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import Personnel
###########crime report#############

from rest_framework import viewsets, permissions, filters
from rest_framework.parsers import MultiPartParser, FormParser
from .models import CrimeReport, Suspect
from .serializers import CrimeReportSerializer, CrimeReportMiniSerializer, SuspectSerializer
User = get_user_model()

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username  # Optional extra info
        return token

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Optional: lagay mo dito sa token mismo
        token['is_admin'] = user.is_admin
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        data['is_admin'] = self.user.is_admin  # <-- importante para sa frontend
        return data

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer




class RegisterView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "User registered successfully."}, status=201)
        return Response(serializer.errors, status=400)
    

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['username'] = user.username
        token['is_staff'] = user.is_staff  # or use your custom field like user.role

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Add extra user info to the response
        data['username'] = self.user.username
        data['is_staff'] = self.user.is_staff  # or use user.role here

        return data

# Custom View
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(username=username, password=password)

        if user is not None:
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'is_admin': user.is_staff  # optional: to distinguish admin
            })
        else:
            return Response({'error': 'Invalid credentials'}, status=401)
        

class UserLoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(username=username, password=password)

        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        if user.is_staff:  # admin or staff user
            return Response({"detail": "Admins cannot login here."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'is_admin': user.is_staff,
        })


class AdminLoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_staff:
            return Response({"detail": "Only admin accounts can log in here."}, status=status.HTTP_403_FORBIDDEN)

        response = super().post(request, *args, **kwargs)
        data = response.data
        data["is_staff"] = user.is_staff
        return Response(data)
    

#############profile information#############

class PersonnelProfileViewSet(viewsets.ModelViewSet):
    queryset = PersonnelProfile.objects.all()
    serializer_class = PersonnelProfileSerializer
    filterset_fields = ["is_archived"] 
    ordering_fields = ["created_at", "id"]
    ordering = ["-created_at"]   

    
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        obj = self.get_object()
        obj.is_archived = True
        obj.save(update_fields=["is_archived"])
        return Response({"status": "archived", "id": obj.id, "is_archived": True})

        
    



class RegionListAPIView(generics.ListAPIView):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer



@csrf_exempt
def archive_personnel(request, pk):
    if request.method == "POST":
        personnel = get_object_or_404(Personnel, pk=pk)
        personnel.is_active = False  # or lagay mo sa archive column mo
        personnel.save()
        return JsonResponse({"message": "Personnel archived successfully"})
    else:
        raise Http404("Only POST method is allowed")
    

###################crime report####################

class CrimeReportViewSet(viewsets.ModelViewSet):  # ⬅️ from ReadOnlyModelViewSet -> ModelViewSet
    queryset = CrimeReport.objects.filter(is_archived=False).order_by("-created_at")
    serializer_class = CrimeReportSerializer            # ⬅️ full serializer (may v_photo)
    permission_classes = [permissions.AllowAny]         # adjust as you need
    parser_classes = [MultiPartParser, FormParser]      # ⬅️ para tumanggap ng file uploads
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ["created_at", "happened_at"]
    search_fields = ["crime_type", "v_first_name", "v_last_name"]


class SuspectViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for suspects (separate from CrimeReport).
    """
    queryset = Suspect.objects.select_related("crime_report").all().order_by("-created_at")
    serializer_class = SuspectSerializer
    permission_classes = [permissions.AllowAny]  # adjust as needed
    parser_classes = [MultiPartParser, FormParser]  # to accept image + form data
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ["created_at"]
    search_fields = [
        "s_first_name", "s_middle_name", "s_last_name",
        "s_barangay", "s_city_municipality", "s_province",
        "loc_barangay", "loc_city_municipality", "loc_province",
    ]
class CrimeReportListCreateView(generics.ListCreateAPIView):
    queryset = CrimeReport.objects.all()
    serializer_class = CrimeReportSerializer

class SuspectListCreateView(generics.ListCreateAPIView):
    queryset = Suspect.objects.all()
    serializer_class = SuspectSerializer
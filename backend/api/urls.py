from django.urls import path,include
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    MyTokenObtainPairView,  # ito yung may is_admin
    CustomTokenObtainPairView,
    UserLoginView, 
    AdminLoginView, 
    CrimeReportListCreateView,
    SuspectListCreateView, # kung may special kang login
)
from . import views

from rest_framework.routers import DefaultRouter
from .views import PersonnelProfileViewSet
from .views import RegionListAPIView

from .views import CrimeReportViewSet,SuspectViewSet

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='custom_login'),
    path('user/login/', UserLoginView.as_view(), name='user_login'),
    path('admin/login/', AdminLoginView.as_view(), name='admin_login'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),

    # JWT login para sa users
    path('api/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),

    path('api/regions/', RegionListAPIView.as_view(), name='regions-list'),


    path("api/personnel/<int:pk>/archive/", views.archive_personnel, name="archive_personnel"),

    path("api/crimes/", CrimeReportListCreateView.as_view(), name="crime-list"),
    path("api/suspects/", SuspectListCreateView.as_view(), name="suspect-list"),
]

router = DefaultRouter()
router.register(r"personnel", PersonnelProfileViewSet, basename="personnel")
router.register(r"crimes",   CrimeReportViewSet, basename="crime")
router.register(r"suspects", SuspectViewSet,     basename="suspect")

# Idagdag ang router.urls sa urlpatterns para hindi mawala yung ibang paths
urlpatterns += router.urls

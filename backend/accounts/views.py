from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    data = request.data
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''

    errors = {}
    if not first_name:
        errors['first_name'] = 'First name is required.'
    if not last_name:
        errors['last_name'] = 'Last name is required.'
    if not username:
        errors['username'] = 'Username is required.'
    elif User.objects.filter(username=username).exists():
        errors['username'] = 'This username is already taken.'
    if not email:
        errors['email'] = 'Email is required.'
    elif User.objects.filter(email=email).exists():
        errors['email'] = 'An account with this email already exists.'
    if not password:
        errors['password'] = 'Password is required.'
    elif len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters.'
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    return Response({'detail': 'Account created.'}, status=status.HTTP_201_CREATED)

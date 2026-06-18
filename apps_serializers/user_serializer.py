from rest_framework import serializers



class OTPRequestSerializer(serializers.Serializer):
    number = serializers.CharField(
        max_length=11,
        required=True
    )

class OTPVerifySerializer(serializers.Serializer):
    number = serializers.CharField(max_length=11)
    otp = serializers.CharField(max_length=6)
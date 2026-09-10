import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/entities/user.entity';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Token de acesso (JWT) a ser enviado nas próximas requisições.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZjlhIn0.T0tFTg',
  })
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Validade do token em segundos, a partir de agora.', example: 3600 })
  expiresIn!: number;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

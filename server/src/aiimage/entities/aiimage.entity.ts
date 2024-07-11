import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AiImageParamsDTO } from '../dto/aiimage-params.dto';
import { AiImageStatus } from '../enum/aiimage-status.enum';

@Entity('AiImage')
export class AiImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'json' })
  params: AiImageParamsDTO;

  @Column({ type: 'enum', enum: AiImageStatus })
  status: AiImageStatus;

  @Column({ length: 256, default: '' })
  imageUrl: string;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;
}
